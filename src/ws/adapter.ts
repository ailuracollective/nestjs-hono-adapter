import type { Server as HttpServer } from 'node:http';

import type { WsMessageHandler } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { AbstractWsAdapter } from '@nestjs/websockets';
import {
  EMPTY,
  catchError,
  filter,
  first,
  fromEvent,
  map,
  mergeMap,
  share,
  takeUntil,
} from 'rxjs';
import type { Observable } from 'rxjs';

import { createNodeWebSocket } from '@hono/node-ws';

import type { NestHono } from '../core/context.ts';
import type { Server } from '../core/server.ts';
import type { ServerAdapter } from '../core/server-adapter.ts';
import type { WebSocketSupport } from '../core/transport.ts';
import {
  CLOSE_EVENT,
  HonoSocket,
  MESSAGE_EVENT,
  isReply,
  parseFrame,
  toReply,
} from './client.ts';
import type { WsFrame } from './client.ts';
import { GatewayServer } from './server.ts';

/** The port a gateway asks for when it keeps the HTTP one. */
const UNDERLYING_PORT = 0;

/** The path a gateway listens on when it named none. */
const ROOT_PATH = '/';

/** The event Node reports a protocol upgrade on. */
const UPGRADE_EVENT = 'upgrade';

/** What Nest passes to `create()` for one gateway. */
interface HonoGatewayOptions {
  /** The path the gateway listens on. */
  readonly path?: string;
  /** The namespace the gateway asked for. */
  readonly namespace?: string;
}

/**
 * The part of a message event this adapter reads, named here
 * rather than taken from the DOM library this package does not
 * build against.
 */
interface WsMessageEvent {
  /** The frame the socket delivered. */
  readonly data: unknown;
}

/** Gives a gateway path the leading slash a route needs. */
function normalizePath(path?: string): string {
  if (path === undefined || path === '') {
    return ROOT_PATH;
  }
  if (path.startsWith(ROOT_PATH)) {
    return path;
  }
  return `/${path}`;
}

/** The handlers of one gateway, by the event each answers. */
function indexHandlers(
  handlers: WsMessageHandler[],
): Map<string, WsMessageHandler> {
  const byEvent = new Map<string, WsMessageHandler>();
  for (const handler of handlers) {
    byEvent.set(handler.message, handler);
  }
  return byEvent;
}

/**
 * Removes the upgrade listeners `@hono/node-ws` installed on
 * the server, keeping the ones that were there first. Node
 * types a listener as `Function`, and `off` takes one, so the
 * listener is narrowed to the shape `off` accepts.
 */
function detachUpgradeListeners(
  server: HttpServer,
  kept: readonly unknown[],
): void {
  for (const listener of server.listeners(UPGRADE_EVENT)) {
    if (!kept.includes(listener)) {
      server.off(
        UPGRADE_EVENT,
        listener as (...args: unknown[]) => void,
      );
    }
  }
}

/**
 * The websocket surface Node has had all along, and the one a
 * deployment gets when the transport it injected carries no
 * helper of its own. `@hono/node-ws` upgrades a request by
 * asking the Hono application for the gateway path, so the
 * upgrade happens on the HTTP server rather than on a second
 * one opened beside it. It is demanded here, in the island,
 * rather than by any transport, so an application that serves
 * no websocket never installs it.
 */
function nodeWebSocket(app: NestHono): WebSocketSupport {
  const node = createNodeWebSocket({ app });
  return {
    install: (server: Server): (() => void) => {
      const native = server as unknown as HttpServer;
      const before = native.listeners(UPGRADE_EVENT);
      node.injectWebSocket(native);
      return () => {
        detachUpgradeListeners(native, before);
      };
    },
    upgradeWebSocket:
      node.upgradeWebSocket as unknown as WebSocketSupport['upgradeWebSocket'],
  };
}

/**
 * WebSocket adapter that runs Nest's gateways on the Hono
 * application the HTTP adapter already serves. The transport
 * the HTTP adapter was built with upgrades the request when it
 * carries a helper — `hono/bun` on Bun, the host's own on a
 * fetch deployment — and `@hono/node-ws` answers otherwise, so
 * the upgrade happens on one server rather than a second opened
 * beside it; one route is registered per path a gateway named,
 * and each hands Nest a {@link HonoSocket} to answer on. A
 * gateway that asked for its own port or for a namespace cannot
 * be served this way, and both are refused rather than quietly
 * served on the HTTP server.
 */
class HonoWsAdapter extends AbstractWsAdapter {
  private readonly adapter: ServerAdapter;
  private readonly support: WebSocketSupport;
  private readonly servers = new Map<string, GatewayServer>();
  private readonly logger = new Logger(HonoWsAdapter.name);
  private detach: (() => void) | undefined;
  private injected = false;

  public constructor(httpAdapter: ServerAdapter) {
    super(httpAdapter);
    this.adapter = httpAdapter;
    const app = httpAdapter.getHono();
    const factory =
      httpAdapter.getTransport().createWebSocket ??
      nodeWebSocket;
    this.support = factory(app);
  }

  public override create(
    port: number,
    options: HonoGatewayOptions = {},
  ): GatewayServer {
    this.ensureSupported(port, options);
    return this.open(normalizePath(options.path));
  }

  /**
   * Bridges the handlers Nest explored for one client onto the
   * frames that client sends. Every subscription is tied to the
   * socket's own close event, so a connection that goes away
   * takes its subscriptions with it.
   */
  public override bindMessageHandlers(
    client: HonoSocket,
    handlers: WsMessageHandler[],
    transform: (data: unknown) => Observable<unknown>,
  ): void {
    const byEvent = indexHandlers(handlers);
    const closed = fromEvent(client, CLOSE_EVENT).pipe(
      share(),
      first(),
    );
    const answers = fromEvent(client, MESSAGE_EVENT).pipe(
      mergeMap((raw: unknown) =>
        this.answer(raw, byEvent, transform),
      ),
      takeUntil(closed),
    );
    answers.subscribe((reply) => {
      client.sendJson(reply);
    });
  }

  public override bindClientDisconnect(
    client: HonoSocket,
    callback: () => void,
  ): void {
    client.once(CLOSE_EVENT, callback);
  }

  /** Closes every socket a gateway path is serving. */
  public override close(server: GatewayServer): Promise<void> {
    server.close();
    return Promise.resolve();
  }

  /** Releases the paths and the sockets this adapter registered. */
  public override dispose(): Promise<void> {
    this.release();
    return Promise.resolve();
  }

  private release(): void {
    const servers = [...this.servers.values()];
    this.servers.clear();
    for (const server of servers) {
      server.close();
    }
    const { detach } = this;
    if (detach !== undefined) {
      detach();
    }
    this.detach = undefined;
    this.injected = false;
  }

  /**
   * Serves one path, reusing the server already serving it:
   * Nest asks once per path, and a repeated ask must not
   * register the route twice.
   */
  private open(path: string): GatewayServer {
    const known = this.servers.get(path);
    if (known !== undefined) {
      return known;
    }
    const server = new GatewayServer();
    this.servers.set(path, server);
    this.serve(path, server);
    this.inject();
    return server;
  }

  /** Registers the upgrade route one gateway path needs. */
  private serve(path: string, server: GatewayServer): void {
    const upgrade = this.support.upgradeWebSocket(() => {
      const client = new HonoSocket();
      return {
        onClose: (): void => {
          client.disconnect();
        },
        onMessage: (event: WsMessageEvent): void => {
          client.deliver(event.data);
        },
        onOpen: (_event, socket): void => {
          client.use(socket);
          server.accept(client);
        },
      };
    });
    this.adapter.getHono().get(path, upgrade);
  }

  /** Lets the runtime's server hand upgrades to the Hono app. */
  private inject(): void {
    if (this.injected) {
      return;
    }
    this.detach = this.support.install(
      this.adapter.getHttpServer(),
    );
    this.injected = true;
  }

  /** Answers one frame, when a handler claims its event. */
  private answer(
    raw: unknown,
    byEvent: ReadonlyMap<string, WsMessageHandler>,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    const frame = parseFrame(raw);
    if (frame === undefined) {
      return EMPTY;
    }
    const handler = byEvent.get(frame.event);
    if (handler === undefined) {
      return EMPTY;
    }
    return this.invoke(handler, frame, transform);
  }

  /** Runs one handler and turns its answer into frames. */
  private invoke(
    handler: WsMessageHandler,
    frame: WsFrame,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    try {
      return this.replies(
        transform(handler.callback(frame.data)),
        frame,
      );
    } catch (error) {
      return this.report(error);
    }
  }

  /** The frames one handler's stream answers with. */
  private replies(
    stream: Observable<unknown>,
    frame: WsFrame,
  ): Observable<unknown> {
    return stream.pipe(
      map((value) => toReply(frame, value)),
      filter(isReply),
      catchError((error: unknown) => this.report(error)),
    );
  }

  /** Reports a handler that failed and answers nothing. */
  private report(error: unknown): Observable<never> {
    this.logger.error(error);
    return EMPTY;
  }

  /** Refuses the gateways this adapter cannot serve. */
  private ensureSupported(
    port: number,
    options: HonoGatewayOptions,
  ): void {
    if (port !== UNDERLYING_PORT) {
      throw new TypeError(
        'HonoWsAdapter serves every gateway on the HTTP ' +
          `adapter's server, so the gateway port ${port} ` +
          'cannot be honoured.',
      );
    }
    if (options.namespace !== undefined) {
      throw new TypeError(
        'HonoWsAdapter does not support WebSocket namespaces.',
      );
    }
  }
}

export { HonoWsAdapter };
export type { HonoGatewayOptions };

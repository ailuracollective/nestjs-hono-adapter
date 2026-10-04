import type { ServerType } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import type { NodeWebSocket } from '@hono/node-ws';
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

import type { ServerAdapter } from './core/server-adapter.ts';
import {
  CLOSE_EVENT,
  HonoSocket,
  MESSAGE_EVENT,
  isReply,
  parseFrame,
  toReply,
} from './ws-client.ts';
import type { WsFrame } from './ws-client.ts';
import { GatewayServer } from './ws-server.ts';

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
 * The part of a message event this adapter reads. It is named
 * here rather than taken from the DOM library, which this
 * package does not build against.
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
 * the server. Node types a listener as `Function`, which `off`
 * does not accept, so the call goes through `Reflect.apply`,
 * whose argument list carries no type.
 */
function detachUpgradeListeners(
  server: ServerType,
  kept: readonly unknown[],
): void {
  const off = server.off.bind(server);
  for (const listener of server.listeners(UPGRADE_EVENT)) {
    if (!kept.includes(listener)) {
      Reflect.apply(off, undefined, [UPGRADE_EVENT, listener]);
    }
  }
}

/**
 * WebSocket adapter that runs Nest's gateways on the Hono
 * application the HTTP adapter already serves.
 *
 * `@hono/node-ws` upgrades a request by asking the Hono
 * application for the gateway path, so the upgrade happens on
 * one server rather than on a second one opened beside it. One
 * route is registered per path a gateway named, and each route
 * hands Nest a {@link HonoSocket} to answer on.
 *
 * A gateway that asked for its own port or for a namespace
 * cannot be served this way; both are refused rather than
 * quietly served on the HTTP server.
 */
class HonoWsAdapter extends AbstractWsAdapter {
  private readonly adapter: ServerAdapter;
  private readonly node: NodeWebSocket;
  private readonly servers = new Map<string, GatewayServer>();
  private readonly logger = new Logger(HonoWsAdapter.name);
  private detach: (() => void) | undefined;
  private injected = false;

  public constructor(httpAdapter: ServerAdapter) {
    super(httpAdapter);
    this.adapter = httpAdapter;
    this.node = createNodeWebSocket({
      app: httpAdapter.getHono(),
    });
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

  /**
   * Releases the paths, the sockets and the WebSocket server
   * this adapter created, and takes the upgrade listeners back
   * off the Node server.
   */
  public override dispose(): Promise<void> {
    this.release();
    return Promise.resolve();
  }

  /**
   * Releases the paths, the sockets, the WebSocket server and
   * the upgrade listeners this adapter registered.
   */
  private release(): void {
    const servers = [...this.servers.values()];
    this.servers.clear();
    for (const server of servers) {
      server.close();
    }
    this.node.wss.close();
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
    const upgrade = this.node.upgradeWebSocket(() => {
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

  /** Lets the Node server hand upgrades to the Hono app. */
  private inject(): void {
    if (this.injected) {
      return;
    }
    const server = this.adapter.getHttpServer();
    const before = server.listeners(UPGRADE_EVENT);
    this.node.injectWebSocket(server);
    this.detach = (): void => {
      detachUpgradeListeners(server, before);
    };
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

import type { Server as HttpServer } from 'node:http';

import type { WSContext } from 'hono/ws';

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

import type {
  NestHono,
  Server,
  ServerAdapter,
  WebSocketSupport,
} from '@ailura/nestjs-hono-adapter';
import {
  CLOSE_EVENT,
  HonoSocket,
  MESSAGE_EVENT,
  indexHandlers,
  isReply,
  parseFrame,
  readFrame,
  toReply,
} from './client.ts';
import type {
  HonoWsAdapterOptions,
  MessageParser,
  WsFrame,
  WsMessageEvent,
} from './client.ts';
import {
  CONNECTION_EVENT,
  GatewayServer,
  normalizePath,
} from './server.ts';
import type { HonoGatewayOptions } from './server.ts';

/** The port a gateway asks for when it keeps the HTTP one. */
const UNDERLYING_PORT = 0;

/** The event a socket, or the server itself, fails on. */
const ERROR_EVENT = 'error';

/** The event Node reports a protocol upgrade on. */
const UPGRADE_EVENT = 'upgrade';

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
    upgradeWebSocket: node.upgradeWebSocket,
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
  private parser: MessageParser;

  public constructor(
    httpAdapter: ServerAdapter,
    options: HonoWsAdapterOptions = {},
  ) {
    super(httpAdapter);
    this.adapter = httpAdapter;
    const app = httpAdapter.getHono();
    const factory =
      httpAdapter.getTransport().createWebSocket ??
      nodeWebSocket;
    this.support = factory(app);
    this.parser = options.messageParser ?? parseFrame;
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

  /**
   * Replaces the reader of incoming frames, as `platform-ws`
   * does.
   */
  public setMessageParser(parser: MessageParser): void {
    this.parser = parser;
  }

  /**
   * Attaches the error listeners every path needs, as
   * `platform-ws` does, and answers the server so a caller can
   * chain the call. A failure on the server or on one of its
   * sockets is reported rather than thrown: an emitter that
   * raises `error` with no listener throws it out of the event
   * loop instead.
   */
  public bindErrorHandler(
    server: GatewayServer,
  ): GatewayServer {
    server.on(ERROR_EVENT, (error: unknown) => {
      this.logger.error(error);
    });
    server.on(CONNECTION_EVENT, (socket: HonoSocket) => {
      socket.on(ERROR_EVENT, (error: unknown) => {
        this.logger.error(error);
      });
    });
    return server;
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
    const server = this.bindErrorHandler(new GatewayServer());
    this.servers.set(path, server);
    this.serve(path, server);
    this.inject();
    return server;
  }

  /**
   * Registers the upgrade route one gateway path needs.
   *
   * The connection is bound on the first `onMessage` rather
   * than on `onOpen`. `@hono/node-ws` and `hono/bun` fire
   * `onOpen` once the socket exists, but a fetch host's helper
   * need not: Hono runs this factory _before_ the upgrade, so
   * `@hono/cloudflare-workers` types its helper as
   * `Omit<WSEvents, 'onOpen'>` and never calls it. `onMessage`
   * is the first event every helper fires after the handshake,
   * with the same `WSContext` `onOpen` would have carried, so
   * binding there answers on a host with no open event at all.
   *
   * A client that connects and never sends is not bound until
   * it does. It holds no socket the gateway can write to
   * anyway, and the connection that matters — one that carries
   * a message — is bound before that message is delivered.
   *
   * `accept` runs once per connection. Two events can carry the
   * same socket — `onOpen` then `onMessage`, which is what a
   * helper with an open event does — and `GatewayServer.accept`
   * emits `connection` every time, so a second call would hand
   * Nest the same socket twice and it would bind every handler
   * a second time. One frame would then answer twice. The
   * socket is still written on every bind, so the latest one
   * wins if a helper hands over two.
   */
  private serve(path: string, server: GatewayServer): void {
    const upgrade = this.support.upgradeWebSocket(() => {
      const client = new HonoSocket();
      let accepted = false;
      const bind = (socket: WSContext): void => {
        client.use(socket);
        if (!accepted) {
          accepted = true;
          server.accept(client);
        }
      };
      return {
        onClose: (_event, socket): void => {
          bind(socket);
          client.disconnect();
        },
        onError: (event): void => {
          if (!accepted) {
            // No connection listener exists before the first socket event.
            client.once(ERROR_EVENT, (error: unknown) => {
              this.logger.error(error);
            });
          }
          client.emit(ERROR_EVENT, event);
        },
        onMessage: (
          event: WsMessageEvent,
          socket: WSContext,
        ): void => {
          bind(socket);
          client.deliver(event.data);
        },
        onOpen: (_event, socket): void => {
          bind(socket);
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
    const frame = readFrame(raw, this.parser, this.logger);
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
    const refused = Object.keys(options).find(
      (name) => name !== 'path',
    );
    if (refused !== undefined) {
      throw new TypeError(
        `HonoWsAdapter cannot honour the gateway option ${refused}.`,
      );
    }
  }
}

export { HonoWsAdapter };

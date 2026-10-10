import type { NestApplicationOptions } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import type { WSContext } from 'hono/ws';

import type {
  NestContext,
  NestEnv,
  NestHono,
} from './context.ts';
import type { Server } from './server.ts';

/**
 * The runtime-specific half of the adapter. The core owns the
 * Hono application, the routing and the request/response
 * translation; a transport owns the four things that differ
 * from one runtime to the next: how a server is built, how a
 * request is bound to it, how a directory is served from the
 * filesystem, and how a connection is upgraded to a WebSocket.
 *
 * Each implementation lives behind its own subpath — never in
 * the core — so a deployment loads one runtime's modules and no
 * other's. That is the same split Hono makes between
 * `hono/bun`, `hono/deno` and `@hono/node-server`.
 */

/** What the core hands a transport when it builds the server. */
interface ServerOptions {
  readonly httpsOptions?:
    | NestApplicationOptions['httpsOptions']
    | undefined;
}

/** What the core hands a transport to serve one directory. */
interface StaticOptions {
  /** The directory a request is read from. */
  readonly root: string;
  /** The file a directory request is answered with. */
  readonly index: string;
  /** The request path, with any mount prefix already removed. */
  readonly rewriteRequestPath?: (path: string) => string;
}

/**
 * The events one connection answers, as every runtime's
 * websocket helper describes them. The socket is Hono's own
 * `WSContext`, which each helper builds over its runtime's
 * connection.
 */
interface WebSocketEvents {
  readonly onClose?:
    | ((event: unknown, socket: WSContext) => void)
    | undefined;
  readonly onError?: ((event: unknown) => void) | undefined;
  readonly onMessage?:
    | ((event: { readonly data: unknown }) => void)
    | undefined;
  readonly onOpen?:
    | ((event: unknown, socket: WSContext) => void)
    | undefined;
}

/**
 * The handler a transport's websocket helper runs per
 * connection.
 */
type WebSocketFactory = (
  context: NestContext,
) => WebSocketEvents;

/** The websocket surface one runtime provides. */
interface WebSocketSupport {
  /** A route handler that upgrades the requests it answers. */
  readonly upgradeWebSocket: (
    factory: WebSocketFactory,
  ) => MiddlewareHandler<NestEnv>;
  /**
   * Lets the server hand upgrades to that handler. Answers a
   * disposer that releases whatever it installed.
   */
  readonly install: (server: Server) => () => void;
}

interface Transport {
  /** Builds the server Nest drives for this runtime. */
  readonly createServer: (
    app: NestHono,
    options: ServerOptions,
  ) => Server;
  /** The middleware that serves one directory of files. */
  readonly serveStatic: (
    options: StaticOptions,
  ) => MiddlewareHandler<NestEnv>;
  /**
   * The websocket helper for the application it is given, where
   * the runtime has one. The Node transport leaves it out — the
   * `/ws` island falls back to `@hono/node-ws`, which is a peer
   * a deployment installs only when it serves websockets — and
   * the fetch transport answers whatever its host passed.
   */
  readonly createWebSocket?:
    | ((app: NestHono) => WebSocketSupport)
    | undefined;
}
export type {
  ServerOptions,
  StaticOptions,
  Transport,
  WebSocketEvents,
  WebSocketFactory,
  WebSocketSupport,
};

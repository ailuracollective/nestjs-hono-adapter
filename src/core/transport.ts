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
 *
 * `onMessage` carries it as a second argument because every
 * helper passes it there — `@hono/node-ws` and `hono/bun` also
 * fire `onOpen`, but a fetch host's helper cannot: Hono runs
 * the factory before the upgrade, so `@hono/cloudflare-workers`
 * types its helper as `Omit<WSEvents, 'onOpen'>`. The message
 * is the first event after the handshake on every helper, so it
 * is where a consumer without an open event reads the socket
 * from.
 */
interface WebSocketEvents {
  readonly onClose?: (
    event: unknown,
    socket: WSContext,
  ) => void;
  readonly onError?: (event: unknown) => void;
  readonly onMessage?: (
    event: { readonly data: unknown },
    socket: WSContext,
  ) => void;
  readonly onOpen?: (event: unknown, socket: WSContext) => void;
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

import type { NestApplicationOptions } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import type { WSContext } from 'hono/ws';

import type {
  NestContext,
  NestEnv,
  NestHono,
} from '#adapter/core/context';
import type { Server } from './server.ts';

/** What the core hands a transport when it builds the server. */
interface ServerOptions {
  /** The application Nest built, with its request handler. */
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

/** The events one websocket connection answers. */
interface WebSocketEvents {
  /** The event the connection is closed. */
  readonly onClose?: (
    event: unknown,
    socket: WSContext,
  ) => void;
  /** The event the connection errors. */
  readonly onError?: (event: unknown) => void;
  /** The event the connection receives a message. */
  readonly onMessage?: (
    event: { readonly data: unknown },
    socket: WSContext,
  ) => void;
  /** The event the connection is opened. */
  readonly onOpen?: (event: unknown, socket: WSContext) => void;
}

/** The handler a transport runs per websocket connection. */
type WebSocketFactory = (
  context: NestContext,
) => WebSocketEvents;

/** The websocket surface one runtime provides. */
interface WebSocketSupport {
  /** A route handler that upgrades the requests it answers. */
  readonly upgradeWebSocket: (
    factory: WebSocketFactory,
  ) => MiddlewareHandler<NestEnv>;
  /** Lets the server hand upgrades to that handler. */
  readonly install: (server: Server) => () => void;
}

/** The runtime-specific half of the adapter. */
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
  /** The websocket helper for the application it is given. */
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

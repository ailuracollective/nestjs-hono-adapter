import type { NestApplicationOptions } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import type { WSContext } from 'hono/ws';

import type { NestContext, NestEnv, NestHono } from '#adapter/core/context';
import type { Server } from './server.ts';

interface ServerOptions {
  readonly httpsOptions?: NestApplicationOptions['httpsOptions'] | undefined;
}

interface StaticOptions {
  readonly root: string;
  readonly index: string;
  readonly rewriteRequestPath?: (path: string) => string;
}

interface WebSocketEvents {
  readonly onClose?: (event: unknown, socket: WSContext) => void;
  readonly onError?: (event: unknown) => void;
  readonly onMessage?: (event: { readonly data: unknown }, socket: WSContext) => void;
  readonly onOpen?: (event: unknown, socket: WSContext) => void;
}

type WebSocketFactory = (context: NestContext) => WebSocketEvents;

interface WebSocketSupport {
  readonly upgradeWebSocket: (factory: WebSocketFactory) => MiddlewareHandler<NestEnv>;
  readonly install: (server: Server) => () => void;
}

interface Transport {
  readonly createServer: (app: NestHono, options: ServerOptions) => Server;
  readonly serveStatic: (options: StaticOptions) => MiddlewareHandler<NestEnv>;
  readonly createWebSocket?: ((app: NestHono) => WebSocketSupport) | undefined;
}

export type {
  ServerOptions,
  StaticOptions,
  Transport,
  WebSocketEvents,
  WebSocketFactory,
  WebSocketSupport,
};

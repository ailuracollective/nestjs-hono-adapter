import { createServer as createHttpsServer } from 'node:https';
/* eslint-disable typescript/no-unsafe-type-assertion -- adapting Node's own server needs the narrow casts this repository forbids elsewhere. */

import type { Server as HttpServer } from 'node:http';

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { ServerOptions, StaticOptions, Transport } from '#adapter/core/ports/transport';

import { asServer } from './listen.ts';

type AdaptorOptions = Parameters<typeof createAdaptorServer>[0];

interface NodeServerOptions {
  /**
   * Whether `@hono/node-server` drains unread request bodies and destroys the socket. Disabling is
   * faster but only safe for trusted clients.
   */
  readonly autoCleanupIncoming?: boolean;
  readonly overrideGlobalObjects?: boolean;
}

const createNodeServer = (
  app: NestHono,
  options: ServerOptions,
  transport: NodeServerOptions,
): Server => {
  const adaptor: Record<string, unknown> = {
    fetch: app.fetch,
    overrideGlobalObjects: transport.overrideGlobalObjects ?? true,
  };
  if (transport.autoCleanupIncoming !== undefined)
    adaptor.autoCleanupIncoming = transport.autoCleanupIncoming;
  const certificate = options.httpsOptions;
  if (certificate !== undefined) {
    adaptor.createServer = createHttpsServer;
    adaptor.serverOptions = certificate;
  }
  const server = createAdaptorServer(adaptor as unknown as AdaptorOptions) as unknown as HttpServer;
  return asServer(server);
};

const nodeServeStatic = (options: StaticOptions): MiddlewareHandler<NestEnv> => {
  const config: Record<string, unknown> = {
    index: options.index,
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined)
    config.rewriteRequestPath = options.rewriteRequestPath;
  return serveStatic(
    config as unknown as Parameters<typeof serveStatic>[0],
  ) as MiddlewareHandler<NestEnv>;
};

const nodeServer = (options: NodeServerOptions = {}): Transport => ({
  createServer: (app, serverOptions) => createNodeServer(app, serverOptions, options),
  serveStatic: nodeServeStatic,
});

export { nodeServer };
export type { NodeServerOptions };

import type { NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { ServerOptions, Transport, WebSocketSupport } from '#adapter/core/ports/transport';

import { bunServeStatic } from './bun-runtime.ts';
import { BunServer, noDisposer } from './bun/server.ts';

// oxlint-disable-next-line typescript/consistent-type-imports -- the module's own declaration; a named type import would have to be kept in step by hand and would put a static `hono/bun` specifier in a module that cannot import it statically on Node.
type HonoBun = typeof import('hono/bun');

const importHonoBun = async (): Promise<HonoBun | undefined> => {
  if (typeof Bun === 'undefined') return undefined;
  const bun = await import('hono/bun');
  return bun;
};

// oxlint-disable-next-line node/no-top-level-await -- the module has to be resolved before anything reads the transport, and this package publishes ESM only: `require(esm)` is not a loading path it supports.
const honoBun = await importHonoBun();

const bunWebSocket =
  honoBun &&
  ((app: NestHono): WebSocketSupport => {
    void app;
    return {
      install: (server: Server): (() => void) => {
        if (server instanceof BunServer) {
          // oxlint-disable-next-line typescript/no-deprecated -- `hono/bun` re-exports it; moving to the `@hono/bun` package it points at is a follow-up, and the bytes are already in this entrypoint.
          server.useWebSocket(honoBun.websocket);
        }
        return noDisposer;
      },
      // oxlint-disable-next-line typescript/no-deprecated -- the same `hono/bun` re-export as above.
      upgradeWebSocket: honoBun.upgradeWebSocket,
    };
  });

const createBunServer = (app: NestHono, options: ServerOptions): Server =>
  new BunServer(app, options.httpsOptions);

const bunServer = (): Transport => ({
  createServer: createBunServer,
  createWebSocket: bunWebSocket,
  serveStatic: bunServeStatic,
});

export { toBunTls } from './bun-runtime.ts';
export { BunServer } from './bun/server.ts';
export { bunServer };

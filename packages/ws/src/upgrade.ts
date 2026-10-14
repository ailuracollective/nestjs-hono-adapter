/* eslint-disable typescript/no-unsafe-type-assertion */

import type { Server as HttpServer } from 'node:http';

import { createNodeWebSocket } from '@hono/node-ws';

import type { NestHono, Server, WebSocketSupport } from '@ailura/nestjs-hono-adapter';
import type { HonoGatewayOptions } from './server.ts';

const UNDERLYING_PORT = 0;

const UPGRADE_EVENT = 'upgrade';

const detachUpgradeListeners = (server: HttpServer, kept: readonly unknown[]): void => {
  for (const listener of server.listeners(UPGRADE_EVENT)) {
    if (!kept.includes(listener)) {
      server.off(UPGRADE_EVENT, listener as (...args: unknown[]) => void);
    }
  }
};

const nodeWebSocket = (app: NestHono): WebSocketSupport => {
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
};

const ensureSupported = (port: number, options: HonoGatewayOptions): void => {
  if (port !== UNDERLYING_PORT) {
    throw new TypeError(
      'HonoWsAdapter serves every gateway on the HTTP ' +
        `adapter's server, so the gateway port ${port} ` +
        'cannot be honoured.',
    );
  }
  const refused = Object.keys(options).find((name) => name !== 'path');
  if (refused !== undefined) {
    throw new TypeError(`HonoWsAdapter cannot honour the gateway option ${refused}.`);
  }
};

export { ensureSupported, nodeWebSocket };

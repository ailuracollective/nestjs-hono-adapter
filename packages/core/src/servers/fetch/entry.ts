import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';

import { FetchServer } from './server.ts';
import type { FetchServerOptions } from './server.ts';

/** The error for a capability the fetch transport lacks. */
const unsupportedHost = (capability: string): never => {
  throw new TypeError(
    `The fetch transport does not carry ${capability}; ` +
      `pass it to fetchServer() from the host, or use a ` +
      'platform transport.',
  );
};

/** The fetch transport, for `new ServerAdapter({ transport })`. */
const fetchServer = (
  options: FetchServerOptions = {},
): Transport => ({
  createServer: (): Server => new FetchServer(),
  createWebSocket:
    options.upgradeWebSocket ??
    ((): never => unsupportedHost('WebSockets')),
  serveStatic:
    options.serveStatic ??
    ((): never => unsupportedHost('static assets')),
});

export { fetchServer };

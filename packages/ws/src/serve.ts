import type { BridgeTarget, Server, WebSocketSupport } from '@ailura/nestjs-hono-adapter';

import { serveRoute } from './route.ts';
import { GatewayServer } from './server.ts';

interface Served {
  readonly servers: Map<string, GatewayServer>;
  readonly support: WebSocketSupport;
  readonly target: BridgeTarget;
}

interface AdapterShape {
  readonly httpServer: Server;
  bindErrorHandler: (server: GatewayServer) => unknown;
}

const injected = new WeakSet<object>();

/** The helper an application serves with, made once: a helper belongs to an application, not a path. */
const appFor = (
  served: WeakMap<BridgeTarget, Served>,
  target: BridgeTarget,
): Served | undefined => {
  const known = served.get(target);
  if (known !== undefined) return known;
  const make = target.transport.createWebSocket;
  if (make === undefined) return undefined;
  const fresh: Served = {
    servers: new Map<string, GatewayServer>(),
    support: make(target.hono),
    target,
  };
  served.set(target, fresh);
  return fresh;
};

/** One server and one route per path, and the helper installed on the server once. */
const mount = (adapter: AdapterShape, app: Served, path: string): GatewayServer => {
  const answered = app.servers.get(path);
  if (answered !== undefined) return answered;
  const server = new GatewayServer();
  app.servers.set(path, server);
  adapter.bindErrorHandler(server);
  if (!injected.has(adapter.httpServer)) {
    injected.add(adapter.httpServer);
    app.support.install(adapter.httpServer);
  }
  app.target.hono.get(path, serveRoute(server, app.support));
  return server;
};

export { appFor, mount };
export type { AdapterShape, Served };

import type { MiddlewareHandler } from 'hono';
import type { WSContext } from 'hono/ws';

import type { NestEnv, WebSocketSupport } from '@ailura/nestjs-hono-adapter';

import { GatewayClient } from './client.ts';
import type { GatewayServer } from './server.ts';

/**
 * One Hono route per gateway path. The socket is bound on whichever event of the transport's helper
 * fires first, because a helper that never calls `onOpen` still delivers messages.
 */
const serveRoute = (server: GatewayServer, support: WebSocketSupport): MiddlewareHandler<NestEnv> =>
  support.upgradeWebSocket(() => {
    const client = new GatewayClient(server);
    let accepted = false;
    const bind = (socket: WSContext): void => {
      client.use(socket);
      if (accepted) return;
      accepted = true;
      server.accept(client);
    };
    return {
      onClose: (_event, socket): void => {
        bind(socket);
        client.disconnect();
      },
      onError: (event): void => {
        client.fail(event);
      },
      onMessage: (event, socket): void => {
        bind(socket);
        client.deliver(event.data);
      },
      onOpen: (_event, socket): void => {
        bind(socket);
      },
    };
  });

export { serveRoute };

import type { WSContext } from 'hono/ws';

import type { Logger } from '@nestjs/common';

import type { ServerAdapter, WebSocketSupport } from '@ailura/nestjs-hono-adapter';
import { HonoSocket } from './client/index.ts';
import type { WsMessageEvent } from './client/index.ts';
import { CONNECTION_EVENT } from './server.ts';
import type { GatewayServer } from './server.ts';

const ERROR_EVENT = 'error';

class GatewaySockets {
  private readonly support: WebSocketSupport;
  private readonly logger: Logger;
  private readonly adapter: ServerAdapter;

  public constructor(support: WebSocketSupport, logger: Logger, adapter: ServerAdapter) {
    this.support = support;
    this.logger = logger;
    this.adapter = adapter;
  }

  public attachErrorHandler(server: GatewayServer): GatewayServer {
    server.on(ERROR_EVENT, (error: unknown) => {
      this.logger.error(error);
    });
    server.on(CONNECTION_EVENT, (socket: HonoSocket) => {
      socket.on(ERROR_EVENT, (error: unknown) => {
        this.logger.error(error);
      });
    });
    return server;
  }

  public serve(path: string, server: GatewayServer): void {
    const upgrade = this.support.upgradeWebSocket(() => {
      const client = new HonoSocket();
      let accepted = false;
      const bind = (socket: WSContext): void => {
        client.use(socket);
        if (!accepted) {
          accepted = true;
          server.accept(client);
        }
      };
      return {
        onClose: (_event, socket): void => {
          bind(socket);
          client.disconnect();
        },
        onError: (event): void => {
          if (!accepted) {
            client.once(ERROR_EVENT, (error: unknown) => {
              this.logger.error(error);
            });
          }
          client.emit(ERROR_EVENT, event);
        },
        onMessage: (event: WsMessageEvent, socket: WSContext): void => {
          bind(socket);
          client.deliver(event.data);
        },
        onOpen: (_event, socket): void => {
          bind(socket);
        },
      };
    });
    this.adapter.getHono().get(path, upgrade);
  }
}

export { GatewaySockets };

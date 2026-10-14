import type { WSContext } from 'hono/ws';

import type { Logger } from '@nestjs/common';

import type {
  ServerAdapter,
  WebSocketSupport,
} from '@ailura/nestjs-hono-adapter';
import { HonoSocket } from './client/index.ts';
import type { WsMessageEvent } from './client/index.ts';
import { CONNECTION_EVENT } from './server.ts';
import type { GatewayServer } from './server.ts';

/** The event a socket, or the server itself, fails on. */
const ERROR_EVENT = 'error';

/**
 * Wires the gateways and their sockets onto the Hono
 * application.
 */
class GatewaySockets {
  /** The websocket support the transport answered with. */
  private readonly support: WebSocketSupport;
  /** Reports failures from the gateways and their sockets. */
  private readonly logger: Logger;
  /** The HTTP adapter whose application serves the gateways. */
  private readonly adapter: ServerAdapter;

  /**
   * Wires the sockets of a support on the adapter's
   * application.
   */
  public constructor(
    support: WebSocketSupport,
    logger: Logger,
    adapter: ServerAdapter,
  ) {
    this.support = support;
    this.logger = logger;
    this.adapter = adapter;
  }

  /** Attaches the error listeners every path needs. */
  public attachErrorHandler(
    server: GatewayServer,
  ): GatewayServer {
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

  /** Registers the upgrade route one gateway path needs. */
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
        onMessage: (
          event: WsMessageEvent,
          socket: WSContext,
        ): void => {
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

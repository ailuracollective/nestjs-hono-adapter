import { EventEmitter } from 'node:events';

import { CLOSE_EVENT } from './client/index.ts';
import type { HonoSocket } from './client/index.ts';

const CONNECTION_EVENT = 'connection';

class GatewayServer extends EventEmitter {
  private readonly sockets = new Set<HonoSocket>();

  public accept(socket: HonoSocket): void {
    this.sockets.add(socket);
    socket.once(CLOSE_EVENT, () => {
      this.sockets.delete(socket);
    });
    this.emit(CONNECTION_EVENT, socket);
  }

  public close(): void {
    for (const socket of this.sockets) {
      socket.close();
    }
    this.sockets.clear();
  }
}

const ROOT_PATH = '/';

interface HonoGatewayOptions {
  readonly path?: string;
  readonly [option: string]: unknown;
}

const normalizePath = (path?: string): string => {
  if (path === undefined || path === '') return ROOT_PATH;
  if (path.startsWith(ROOT_PATH)) {
    return path;
  }
  return `/${path}`;
};

export { CONNECTION_EVENT, GatewayServer, normalizePath };
export type { HonoGatewayOptions };

import { EventEmitter } from 'node:events';

import { CLOSE_EVENT } from './client/index.ts';
import type { HonoSocket } from './client/index.ts';

/** The event Nest listens on for every new socket. */
const CONNECTION_EVENT = 'connection';

/** The sockets of one gateway path. */
class GatewayServer extends EventEmitter {
  /** The sockets this path is still serving. */
  private readonly sockets = new Set<HonoSocket>();

  /** Tracks a socket and hands it to Nest. */
  public accept(socket: HonoSocket): void {
    this.sockets.add(socket);
    socket.once(CLOSE_EVENT, () => {
      this.sockets.delete(socket);
    });
    this.emit(CONNECTION_EVENT, socket);
  }

  /** Closes every socket on the path. */
  public close(): void {
    for (const socket of this.sockets) {
      socket.close();
    }
    this.sockets.clear();
  }
}

/** The path a gateway listens on when it named none. */
const ROOT_PATH = '/';

/** What Nest passes to `create()` for one gateway. */
interface HonoGatewayOptions {
  /** The path the gateway listens on. */
  readonly path?: string;
  /** Whatever else the gateway asked for. */
  readonly [option: string]: unknown;
}

/** Gives a gateway path the leading slash a route needs. */
const normalizePath = (path?: string): string => {
  if (path === undefined || path === '') {
    return ROOT_PATH;
  }
  if (path.startsWith(ROOT_PATH)) {
    return path;
  }
  return `/${path}`;
};

export { CONNECTION_EVENT, GatewayServer, normalizePath };
export type { HonoGatewayOptions };

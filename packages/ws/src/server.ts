import { EventEmitter } from 'node:events';

import { CLOSE_EVENT } from './client.ts';
import type { HonoSocket } from './client.ts';

/** The event Nest listens on for every new socket. */
const CONNECTION_EVENT = 'connection';

/**
 * The sockets of one gateway path. Nest binds a connection
 * handler to the server `create()` returns and then, per
 * socket, its message handlers and its disconnect hook: this
 * emits `connection` with each socket and holds it until the
 * path is closed, so no listener outlives the connection it was
 * bound to.
 */
class GatewayServer extends EventEmitter {
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
  /**
   * Whatever else the gateway asked for, which upstream reads
   * as `server` and `namespace` and this adapter refuses beyond
   * the path, because it serves the HTTP adapter's own server.
   */
  readonly [option: string]: unknown;
}

/** Gives a gateway path the leading slash a route needs. */
function normalizePath(path?: string): string {
  if (path === undefined || path === '') {
    return ROOT_PATH;
  }
  if (path.startsWith(ROOT_PATH)) {
    return path;
  }
  return `/${path}`;
}

export { CONNECTION_EVENT, GatewayServer, normalizePath };
export type { HonoGatewayOptions };

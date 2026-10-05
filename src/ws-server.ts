import { EventEmitter } from 'node:events';

import { CLOSE_EVENT } from './ws-client.ts';
import type { HonoSocket } from './ws-client.ts';

/** The event Nest listens on for every new socket. */
const CONNECTION_EVENT = 'connection';

/**
 * The sockets of one gateway path.
 *
 * Nest binds a connection handler to the server `create()`
 * returns and then, per socket, its message handlers and its
 * disconnect hook. This is the emitter those bindings need: it
 * emits `connection` with each socket and holds that socket
 * until the path is closed, so no listener outlives the
 * connection it was bound to.
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

export { GatewayServer };

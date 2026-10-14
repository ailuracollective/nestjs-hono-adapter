import type { GatewayClient } from './client.ts';
import { Emitter } from './emitter.ts';

const CONNECTION_EVENT = 'connection';

const CLOSE_EVENT = 'close';

/**
 * What Nest treats as `platform-ws`'s `ws.Server`: it binds `connection` on it, and `close(server)`
 * reads `clients` and terminates each one.
 */
class GatewayServer extends Emitter {
  public readonly clients = new Set<GatewayClient>();

  public accept(client: GatewayClient): void {
    this.clients.add(client);
    client.once(CLOSE_EVENT, () => {
      this.clients.delete(client);
    });
    this.emit(CONNECTION_EVENT, client);
  }

  public close(callback?: (error?: Error) => void): void {
    for (const client of this.clients) {
      client.terminate();
    }
    this.clients.clear();
    if (callback === undefined) return;
    callback();
  }
}

export { GatewayServer };

import type { WSContext } from 'hono/ws';

import { Emitter } from './emitter.ts';
import type { GatewayServer } from './server.ts';

const MESSAGE_EVENT = 'message';

const CLOSE_EVENT = 'close';

const ERROR_EVENT = 'error';

const OPEN_STATE = 1;

const CLOSED_STATE = 3;

/**
 * The socket `platform-ws` hands a gateway: `readyState`, `send`, `close` and `terminate` are what
 * Nest reads off it, and the events are the ones its own `bindMessageHandlers` subscribes to.
 */
class GatewayClient extends Emitter {
  private readonly server: GatewayServer;
  private socket: WSContext | undefined;

  public constructor(server: GatewayServer) {
    super();
    this.server = server;
  }

  public use(socket: WSContext): void {
    this.socket = socket;
  }

  public deliver(data: unknown): void {
    this.emit(MESSAGE_EVENT, { data });
  }

  public disconnect(): void {
    this.socket = undefined;
    this.emit(CLOSE_EVENT);
  }

  /** A failure before the connection is accepted has no socket listener yet, so the server logs it. */
  public fail(event: unknown): void {
    if (this.listenerCount(ERROR_EVENT) === 0) {
      this.server.emit(ERROR_EVENT, event);
      return;
    }
    this.emit(ERROR_EVENT, event);
  }

  public get readyState(): number {
    return this.socket === undefined ? CLOSED_STATE : this.socket.readyState;
  }

  public send(data: string): void {
    if (this.socket === undefined || this.readyState !== OPEN_STATE) return;
    this.socket.send(data);
  }

  public close(): void {
    if (this.socket !== undefined) this.socket.close();
  }

  public terminate(): void {
    if (this.socket !== undefined) this.socket.close();
  }
}

export { GatewayClient };

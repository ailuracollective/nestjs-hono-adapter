import { EventEmitter } from 'node:events';

import type { WSContext } from 'hono/ws';

import {
  CLOSE_EVENT,
  CLOSED_STATE,
  MESSAGE_EVENT,
  OPEN_STATE,
} from './frames.ts';

/**
 * One client connection, in the shape Nest's WebSocket layer
 * reads.
 */
class HonoSocket extends EventEmitter {
  /** The upgraded socket, once the handshake produced one. */
  private socket: WSContext | undefined;

  /** Binds this client to the socket the upgrade produced. */
  public use(socket: WSContext): void {
    this.socket = socket;
  }

  /** Emits the frame the client sent. */
  public deliver(data: unknown): void {
    this.emit(MESSAGE_EVENT, data);
  }

  /** Says the socket is gone, and only ever once. */
  public disconnect(): void {
    this.socket = undefined;
    this.emit(CLOSE_EVENT);
  }

  /**
   * The socket's state, as the WebSocket specification numbers
   * them.
   */
  public get readyState(): number {
    const { socket } = this;
    if (socket === undefined) {
      return CLOSED_STATE;
    }
    return socket.readyState;
  }

  /** Sends what the caller wrote to the socket. */
  public send(data: string): void {
    const { socket } = this;
    if (
      socket === undefined ||
      socket.readyState !== OPEN_STATE
    ) {
      return;
    }
    socket.send(data);
  }

  /** Sends one answer, unless the socket is no longer open. */
  public sendJson(reply: unknown): void {
    this.send(JSON.stringify(reply));
  }

  /** Closes the socket from this side. */
  public close(): void {
    const { socket } = this;
    if (socket === undefined) {
      return;
    }
    socket.close();
  }
}

export { HonoSocket };

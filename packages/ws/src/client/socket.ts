import { EventEmitter } from 'node:events';

import type { WSContext } from 'hono/ws';

import { CLOSE_EVENT, CLOSED_STATE, MESSAGE_EVENT, OPEN_STATE } from './frames.ts';

class HonoSocket extends EventEmitter {
  private socket: WSContext | undefined;

  public use(socket: WSContext): void {
    this.socket = socket;
  }

  public deliver(data: unknown): void {
    this.emit(MESSAGE_EVENT, data);
  }

  public disconnect(): void {
    this.socket = undefined;
    this.emit(CLOSE_EVENT);
  }

  public get readyState(): number {
    const { socket } = this;
    if (socket === undefined) return CLOSED_STATE;
    return socket.readyState;
  }

  public send(data: string): void {
    const { socket } = this;
    if (socket === undefined || socket.readyState !== OPEN_STATE) return;
    socket.send(data);
  }

  public sendJson(reply: unknown): void {
    this.send(JSON.stringify(reply));
  }

  public close(): void {
    const { socket } = this;
    if (socket === undefined) return;
    socket.close();
  }
}

export { HonoSocket };

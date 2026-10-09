import { EventEmitter } from 'node:events';

import type { WSContext } from 'hono/ws';

/** The event a frame from the client arrives on. */
const MESSAGE_EVENT = 'message';

/** The event that says the socket has gone away. */
const CLOSE_EVENT = 'close';

/** The state a socket is in once it accepts a send. */
const OPEN_STATE = 1;

/**
 * One frame from a client: the event it names, the payload it
 * carries, and the correlation it asked to have repeated.
 */
interface WsFrame {
  /** The event the gateway answers. */
  readonly event: string;
  /** What the handler is given. */
  readonly data?: unknown;
  /** The correlation the answer repeats, when there is one. */
  readonly id?: string | number;
}

/** What a gateway answers with. */
interface WsReply {
  /** The event being answered. */
  readonly event: string;
  /** What the handler returned, when it returned anything. */
  readonly data?: unknown;
  /** The correlation the client asked to have repeated. */
  readonly id?: string | number;
}

/** Says whether a value is a frame, by the event it names. */
function isFrame(value: unknown): value is WsFrame {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'event' in value && typeof value.event === 'string';
}

/**
 * Reads the frame a parsed payload carries; a payload that is
 * only a string names the event and carries no data.
 */
function frameFrom(value: unknown): WsFrame | undefined {
  if (isFrame(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return { event: value };
  }
  return undefined;
}

/**
 * Reads a frame from text; text that is not JSON is the event
 * name itself, so a client may send `ping` as well as
 * `{"event":"ping"}`.
 */
function parseText(text: string): WsFrame | undefined {
  try {
    return frameFrom(JSON.parse(text) as unknown);
  } catch {
    return { event: text };
  }
}

/**
 * Reads a frame from what the socket delivered: text frames
 * arrive as text, binary ones as bytes, and a replayed frame
 * may arrive parsed.
 */
function parseFrame(raw: unknown): WsFrame | undefined {
  if (typeof raw === 'string') {
    return parseText(raw);
  }
  if (raw instanceof Uint8Array) {
    return parseText(new TextDecoder().decode(raw));
  }
  return frameFrom(raw);
}

/** Repeats the correlation the client asked for, when it did. */
function withCorrelation(
  answer: WsReply,
  frame: WsFrame,
): WsReply {
  if (frame.id === undefined) {
    return answer;
  }
  return {
    data: answer.data,
    event: answer.event,
    id: frame.id,
  };
}

/**
 * The frame that answers one, or nothing when the handler
 * answered with nothing and the client asked for no
 * acknowledgement. A handler that answered with its own `{
 * event, data }` keeps that shape, which is what the `ws`
 * platform sends; anything else is wrapped in the event being
 * answered.
 */
function toReply(
  frame: WsFrame,
  value: unknown,
): WsReply | undefined {
  if (value === undefined || value === null) {
    if (frame.id === undefined) {
      return undefined;
    }
    return { event: frame.event, id: frame.id };
  }
  if (isFrame(value)) {
    return withCorrelation(value, frame);
  }
  const answer: WsReply = { data: value, event: frame.event };
  return withCorrelation(answer, frame);
}

/** Says whether an answer is worth sending. */
function isReply(value: WsReply | undefined): value is WsReply {
  return value !== undefined;
}

/**
 * One client connection, in the shape Nest's WebSocket layer
 * reads: a `message` event for every frame the client sends, a
 * `close` event once, and `send()` for the answers. Nest
 * subscribes with `on` and `once`, so this follows the Node
 * emitter its own adapters use rather than an `EventTarget`.
 */
class HonoSocket extends EventEmitter {
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

  /** Sends one answer, unless the socket is no longer open. */
  public sendJson(reply: unknown): void {
    const { socket } = this;
    if (socket === undefined) {
      return;
    }
    if (socket.readyState !== OPEN_STATE) {
      return;
    }
    socket.send(JSON.stringify(reply));
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

export {
  CLOSE_EVENT,
  MESSAGE_EVENT,
  HonoSocket,
  isReply,
  parseFrame,
  toReply,
};
export type { WsFrame, WsReply };

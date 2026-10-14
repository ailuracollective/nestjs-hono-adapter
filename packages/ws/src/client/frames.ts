import type { Logger } from '@nestjs/common';

/** The event a frame from the client arrives on. */
const MESSAGE_EVENT = 'message';

/** The event that says the socket has gone away. */
const CLOSE_EVENT = 'close';

/** The state a socket is in once it accepts a send. */
const OPEN_STATE = 1;

/** The state of a socket this adapter has not bound. */
const CLOSED_STATE = 3;

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
const isFrame = (value: unknown): value is WsFrame => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'event' in value && typeof value.event === 'string';
};

/** Reads the frame a parsed payload carries. */
const frameFrom = (value: unknown): WsFrame | undefined => {
  if (isFrame(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return { event: value };
  }
  return undefined;
};

/** Reads a frame from text. */
const parseText = (text: string): WsFrame | undefined => {
  try {
    return frameFrom(JSON.parse(text) as unknown);
  } catch {
    return { event: text };
  }
};

/** Reads a frame from what the socket delivered. */
const parseFrame = (raw: unknown): WsFrame | undefined => {
  if (typeof raw === 'string') {
    return parseText(raw);
  }
  if (raw instanceof Uint8Array) {
    return parseText(new TextDecoder().decode(raw));
  }
  return frameFrom(raw);
};

/** Reads a frame from raw socket data. */
type MessageParser = (raw: unknown) => WsFrame | undefined;

/** Reads one frame with the parser in use. */
const readFrame = (
  raw: unknown,
  parser: MessageParser,
  logger: Logger,
): WsFrame | undefined => {
  try {
    return parser(raw);
  } catch (error) {
    if (parser !== parseFrame) {
      logger.error(error);
    }
    return undefined;
  }
};

/** Repeats the correlation the client asked for. */
const withCorrelation = (
  answer: WsReply,
  frame: WsFrame,
): WsReply => {
  if (frame.id === undefined) {
    return answer;
  }
  return {
    data: answer.data,
    event: answer.event,
    id: frame.id,
  };
};

/** The frame that answers one, or nothing. */
const toReply = (
  frame: WsFrame,
  value: unknown,
): WsReply | undefined => {
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
};

/** Says whether an answer is worth sending. */
const isReply = (
  value: WsReply | undefined,
): value is WsReply => value !== undefined;

export {
  CLOSE_EVENT,
  CLOSED_STATE,
  MESSAGE_EVENT,
  OPEN_STATE,
  isReply,
  parseFrame,
  readFrame,
  toReply,
};
export type { MessageParser, WsFrame, WsReply };

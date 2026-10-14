import type { Logger } from '@nestjs/common';

const MESSAGE_EVENT = 'message';

const CLOSE_EVENT = 'close';

const OPEN_STATE = 1;

const CLOSED_STATE = 3;

/**
 * One frame from a client: the event it names, the payload it carries, and the correlation it asked
 * to have repeated.
 */
interface WsFrame {
  readonly event: string;
  readonly data?: unknown;
  readonly id?: string | number;
}

interface WsReply {
  readonly event: string;
  readonly data?: unknown;
  readonly id?: string | number;
}

const isFrame = (value: unknown): value is WsFrame => {
  if (typeof value !== 'object' || value === null) return false;
  return 'event' in value && typeof value.event === 'string';
};

const frameFrom = (value: unknown): WsFrame | undefined => {
  if (isFrame(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return { event: value };
  }
  return undefined;
};

const parseText = (text: string): WsFrame | undefined => {
  try {
    return frameFrom(JSON.parse(text) as unknown);
  } catch {
    return { event: text };
  }
};

const parseFrame = (raw: unknown): WsFrame | undefined => {
  if (typeof raw === 'string') return parseText(raw);
  if (raw instanceof Uint8Array) return parseText(new TextDecoder().decode(raw));
  return frameFrom(raw);
};

type MessageParser = (raw: unknown) => WsFrame | undefined;

const readFrame = (raw: unknown, parser: MessageParser, logger: Logger): WsFrame | undefined => {
  try {
    return parser(raw);
  } catch (error) {
    if (parser !== parseFrame) logger.error(error);
    return undefined;
  }
};

const withCorrelation = (answer: WsReply, frame: WsFrame): WsReply => {
  if (frame.id === undefined) return answer;
  return {
    data: answer.data,
    event: answer.event,
    id: frame.id,
  };
};

const toReply = (frame: WsFrame, value: unknown): WsReply | undefined => {
  if (value === undefined || value === null) {
    if (frame.id === undefined) return undefined;
    return { event: frame.event, id: frame.id };
  }
  if (isFrame(value)) {
    return withCorrelation(value, frame);
  }
  const answer: WsReply = { data: value, event: frame.event };
  return withCorrelation(answer, frame);
};

const isReply = (value: WsReply | undefined): value is WsReply => value !== undefined;

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

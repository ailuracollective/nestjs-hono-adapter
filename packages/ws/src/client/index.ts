import type { WsMessageHandler } from '@nestjs/common';

import type { MessageParser } from './frames.ts';

/** What a deployment may hand the adapter at build. */
interface HonoWsAdapterOptions {
  /** Reads the frames every gateway receives. */
  readonly messageParser?: MessageParser;
}

/** The part of a message event this adapter reads. */
interface WsMessageEvent {
  /** The frame the socket delivered. */
  readonly data: unknown;
}

/** The handlers of one gateway, by the event each answers. */
const indexHandlers = (
  handlers: WsMessageHandler[],
): Map<string, WsMessageHandler> => {
  const byEvent = new Map<string, WsMessageHandler>();
  for (const handler of handlers) {
    byEvent.set(handler.message, handler);
  }
  return byEvent;
};

export {
  CLOSE_EVENT,
  MESSAGE_EVENT,
  isReply,
  parseFrame,
  readFrame,
  toReply,
} from './frames.ts';
export { HonoSocket } from './socket.ts';
export type {
  MessageParser,
  WsFrame,
  WsReply,
} from './frames.ts';
export { indexHandlers };
export type { HonoWsAdapterOptions, WsMessageEvent };

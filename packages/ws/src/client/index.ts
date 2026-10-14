import type { WsMessageHandler } from '@nestjs/common';

import type { MessageParser } from './frames.ts';

interface HonoWsAdapterOptions {
  readonly messageParser?: MessageParser;
}

interface WsMessageEvent {
  readonly data: unknown;
}

const indexHandlers = (handlers: WsMessageHandler[]): Map<string, WsMessageHandler> => {
  const byEvent = new Map<string, WsMessageHandler>();
  for (const handler of handlers) {
    byEvent.set(handler.message, handler);
  }
  return byEvent;
};

export { CLOSE_EVENT, MESSAGE_EVENT, isReply, parseFrame, readFrame, toReply } from './frames.ts';
export { HonoSocket } from './socket.ts';
export type { MessageParser, WsFrame, WsReply } from './frames.ts';
export { indexHandlers };
export type { HonoWsAdapterOptions, WsMessageEvent };

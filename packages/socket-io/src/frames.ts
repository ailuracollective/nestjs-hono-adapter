import type { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import type { Namespace, ServerOptions, Socket } from 'socket.io';

const DISCONNECT_EVENT = 'disconnect';

const ATTACHED_PORT = 0;

const LAST = -1;

const UNWRAPPED = 1;

interface IoOptions extends ServerOptions {
  readonly namespace?: string;
  readonly server?: Server;
}

type Ack = (...args: unknown[]) => void;

interface Emitted {
  readonly event: string;
  readonly data?: unknown;
}

interface Payload {
  readonly ack?: Ack;
  readonly data?: unknown;
}

interface Answer {
  readonly ack: Ack | undefined;
  readonly manual: boolean;
  readonly response: unknown;
}

const isCallable = (value: unknown): value is Ack => typeof value === 'function';

const isEmitted = (reply: unknown): reply is Emitted => {
  if (typeof reply !== 'object' || reply === null) return false;
  if (!('event' in reply)) {
    return false;
  }
  return typeof reply.event === 'string';
};

const isAnswered = (reply: unknown): boolean => reply !== null && reply !== undefined;

const splitFrame = (frame: unknown[]): Payload => {
  const last: unknown = frame.at(LAST);
  if (!isCallable(last)) {
    return { data: frame };
  }
  const data = frame.slice(0, LAST);
  if (data.length === UNWRAPPED) {
    return { ack: last, data: data[0] };
  }
  return { ack: last, data };
};

const rootOf = (server: Server | Namespace): Server => {
  if (server instanceof Server) return server;
  return server.server;
};

const deliver = (socket: Socket, answer: Answer, logger: Logger): void => {
  try {
    if (isEmitted(answer.response)) {
      socket.emit(answer.response.event, answer.response.data);
      return;
    }
    if (!answer.manual && answer.ack !== undefined) answer.ack(answer.response);
  } catch (error: unknown) {
    logger.error(error);
  }
};

export {
  ATTACHED_PORT,
  DISCONNECT_EVENT,
  deliver,
  isAnswered,
  isCallable,
  isEmitted,
  rootOf,
  splitFrame,
};
export type { Ack, Answer, Emitted, IoOptions, Payload };

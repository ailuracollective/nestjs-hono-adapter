import type { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import type {
  Namespace,
  ServerOptions,
  Socket,
} from 'socket.io';

/** The event socket.io fires when a client goes away. */
const DISCONNECT_EVENT = 'disconnect';

/** The port that attaches to the server already listening. */
const ATTACHED_PORT = 0;

/** Where the acknowledgement of a frame sits in its array. */
const LAST = -1;

/** The length of the array a frame is unwrapped from. */
const UNWRAPPED = 1;

/** The options that name a namespace and a server. */
interface IoOptions extends ServerOptions {
  readonly namespace?: string;
  readonly server?: Server;
}

/** An acknowledgement a client sent along with its frame. */
type Ack = (...args: unknown[]) => void;

/** A reply a handler asked to send on an event. */
interface Emitted {
  readonly event: string;
  readonly data?: unknown;
}

/** The data of a frame, and the acknowledgement it carried. */
interface Payload {
  readonly ack?: Ack;
  readonly data?: unknown;
}

/** One reply, with what the handler said to do with it. */
interface Answer {
  readonly ack: Ack | undefined;
  readonly manual: boolean;
  readonly response: unknown;
}

/** Says whether a value can be called. */
const isCallable = (value: unknown): value is Ack =>
  typeof value === 'function';

/** Says whether a reply names an event to be sent on. */
const isEmitted = (reply: unknown): reply is Emitted => {
  if (typeof reply !== 'object' || reply === null) {
    return false;
  }
  if (!('event' in reply)) {
    return false;
  }
  return typeof reply.event === 'string';
};

/** Says whether a handler answered anything at all. */
const isAnswered = (reply: unknown): boolean =>
  reply !== null && reply !== undefined;

/** Splits an array frame into data and acknowledgement. */
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

/** The server a namespace belongs to, or the server itself. */
const rootOf = (server: Server | Namespace): Server => {
  if (server instanceof Server) {
    return server;
  }
  return server.server;
};

/** Sends a reply to the client. */
const deliver = (
  socket: Socket,
  answer: Answer,
  logger: Logger,
): void => {
  try {
    if (isEmitted(answer.response)) {
      socket.emit(answer.response.event, answer.response.data);
      return;
    }
    if (!answer.manual && answer.ack !== undefined) {
      answer.ack(answer.response);
    }
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

import { Logger } from '@nestjs/common';

/** The callback every Node stream write and finalizer takes. */
type StreamCallback = (error?: Error | null) => void;

/** The status an event stream answers with when Nest names none. */
const DEFAULT_STATUS = 200;

/** The event a stream emits once its headers are on the wire. */
const STARTED = 'started';

/** The header that says a proxy must not buffer the stream. */
const NO_BUFFERING = 'no';

/** The headers a stream is opened with. */
const STREAM_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-cache',
  'content-type': 'text/event-stream',
  'x-accel-buffering': NO_BUFFERING,
};

/** The frames a stream holds before a writer waits. */
const HIGH_WATER_MARK = 16;

/** What Nest calls once the stream's headers are chosen. */
type CommitListener = (response: Response) => void;

/** What the stream calls once its reader is gone. */
type DisconnectListener = () => void;

/** What the stream says once it is open, and once it is over. */
interface StreamSinks {
  readonly onCommit: CommitListener;
  readonly onDisconnect: DisconnectListener;
  readonly signal: StartSignal;
}

/** Says the stream started, to whoever waits on it. */
type StartSignal = () => void;

/** Says why a stream failed, without taking the process down. */
const logger = new Logger('SseResponse');

/** The bytes of one written frame, or nothing. */
const toBytes = (chunk: unknown): Uint8Array | undefined => {
  if (typeof chunk === 'string') {
    return new TextEncoder().encode(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  return undefined;
};

export {
  DEFAULT_STATUS,
  HIGH_WATER_MARK,
  STREAM_HEADERS,
  STARTED,
  logger,
  toBytes,
};
export type {
  CommitListener,
  DisconnectListener,
  StartSignal,
  StreamCallback,
  StreamSinks,
};

import { Logger } from '@nestjs/common';

type StreamCallback = (error?: Error | null) => void;

const DEFAULT_STATUS = 200;

const STARTED = 'started';

const NO_BUFFERING = 'no';

const STREAM_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-cache',
  'content-type': 'text/event-stream',
  'x-accel-buffering': NO_BUFFERING,
};

const HIGH_WATER_MARK = 16;

type CommitListener = (response: Response) => void;

type DisconnectListener = () => void;

interface StreamSinks {
  readonly onCommit: CommitListener;
  readonly onDisconnect: DisconnectListener;
  readonly signal: StartSignal;
}

type StartSignal = () => void;

const logger = new Logger('SseResponse');

const toBytes = (chunk: unknown): Uint8Array | undefined => {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (chunk instanceof Uint8Array) return chunk;
  return undefined;
};

export { DEFAULT_STATUS, HIGH_WATER_MARK, STREAM_HEADERS, STARTED, logger, toBytes };
export type { CommitListener, DisconnectListener, StartSignal, StreamCallback, StreamSinks };

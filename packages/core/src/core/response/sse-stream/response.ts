import { Writable } from 'node:stream';

import {
  DEFAULT_STATUS,
  HIGH_WATER_MARK,
  STREAM_HEADERS,
  STARTED,
  logger,
  toBytes,
} from './helpers.ts';
import type {
  CommitListener,
  DisconnectListener,
  StartSignal,
  StreamCallback,
  StreamSinks,
} from './helpers.ts';

/** The writable an event stream is written into. */
class SseResponse extends Writable {
  /** Calls the mount once the headers are chosen. */
  private readonly onCommit: CommitListener;
  /** Calls the mount once the reader is gone. */
  private readonly onDisconnect: DisconnectListener;
  /** Says the stream started. */
  private readonly signal: StartSignal;
  /** Reads the status Nest recorded. */
  private readonly status: () => number | undefined;
  /** The body this response answers with. */
  private readonly stream: ReadableStream<Uint8Array>;
  /** The controller of that body. */
  private controller:
    | ReadableStreamDefaultController<Uint8Array>
    | undefined;
  /** The write held until the queue has room. */
  private waiting: StreamCallback | undefined;
  /** Whether the response has been handed over. */
  private committed = false;
  /** Whether the stream is done or abandoned. */
  private cancelled = false;
  /** The headers Nest set on the stream. */
  private headers: Record<string, string> = {};
  /** The status the answer carries. */
  private answerStatus: number = DEFAULT_STATUS;

  /** Builds the writable and its body stream. */
  public constructor(
    status: () => number | undefined,
    sinks: StreamSinks,
  ) {
    super();
    this.status = status;
    this.onCommit = sinks.onCommit;
    this.signal = sinks.signal;
    this.onDisconnect = sinks.onDisconnect;
    this.stream = new ReadableStream<Uint8Array>(
      {
        cancel: (): void => {
          this.cancelled = true;
          this.release();
          this.onDisconnect();
        },
        pull: (): void => {
          this.release();
        },
        start: (controller): void => {
          this.controller = controller;
        },
      },
      { highWaterMark: HIGH_WATER_MARK },
    );
    this.on('error', (error: Error): void => {
      this.logFailure(error);
    });
  }

  /** The status Nest read before the handler ran. */
  public get statusCode(): number | undefined {
    return this.status();
  }

  /** Chooses the answer's status and headers, once. */
  public writeHead(
    status: number,
    headers?: Record<string, string>,
  ): this {
    this.answerStatus = status;
    this.headers = headers ?? {};
    this.commit();
    return this;
  }

  /** Commits the response; nothing is buffered here. */
  public flushHeaders(): void {
    this.commit();
  }

  /** Sets one header on the stream. */
  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /** Turns what Nest wrote into the Hono response, once. */
  private commit(): void {
    if (this.committed) {
      return;
    }
    this.committed = true;
    const headers = new Headers(STREAM_HEADERS);
    for (const [name, value] of Object.entries(this.headers)) {
      headers.set(name, value);
    }
    this.onCommit(
      new Response(this.stream, {
        headers,
        status: this.answerStatus,
      }),
    );
    this.emit(STARTED);
    this.signal();
  }

  /** Hands a frame to the web stream. */
  private enqueue(
    chunk: Uint8Array,
    callback: StreamCallback,
  ): void {
    const { controller } = this;
    if (this.cancelled || controller === undefined) {
      callback();
      return;
    }
    controller.enqueue(chunk);
    const room = controller.desiredSize;
    if (room === null || room > 0) {
      callback();
      return;
    }
    this.waiting = callback;
  }

  /** Lets a held write finish, once the queue has room again. */
  private release(): void {
    const { waiting } = this;
    this.waiting = undefined;
    if (waiting !== undefined) {
      waiting();
    }
  }

  /** Closes the body stream, once. */
  private finish(): void {
    const { controller } = this;
    this.release();
    if (this.cancelled || controller === undefined) {
      return;
    }
    this.cancelled = true;
    controller.close();
  }

  /** Reports a failed write. */
  private logFailure(error: Error): void {
    logger.debug(error.message);
  }

  /** Writes one chunk of the stream. */
  public override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: StreamCallback,
  ): void {
    this.commit();
    const bytes = toBytes(chunk);
    if (bytes === undefined) {
      callback(
        new TypeError('An event stream carries bytes only.'),
      );
      return;
    }
    this.enqueue(bytes, callback);
  }

  /** Finishes the stream when Nest ends it. */
  public override _final(callback: StreamCallback): void {
    this.finish();
    callback();
  }

  /** Releases the stream when it is destroyed. */
  public override _destroy(
    error: Error | null,
    callback: StreamCallback,
  ): void {
    this.finish();
    callback(error);
  }
}

export { SseResponse };

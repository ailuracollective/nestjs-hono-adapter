/**
 * The writable an event stream is written into. Nest pipes a
 * `@Sse()` route's observable onto the object it reads as its
 * response, and that object has to be a genuine `Writable`:
 * this one collects what Nest writes and hands the same bytes
 * to a `ReadableStream`, which becomes the Hono response. It
 * lives apart from the module that mounts it because it is a
 * different thing — the stream itself, all bytes and pacing,
 * knowing nothing of controllers, routes or contexts.
 */

import { Writable } from 'node:stream';

import { Logger } from '@nestjs/common';

/** The callback every Node stream write and finalizer takes. */
type StreamCallback = (error?: Error | null) => void;

/** The status an event stream answers with when Nest names none. */
const DEFAULT_STATUS = 200;

/** The event a stream emits once its headers are on the wire. */
const STARTED = 'started';

/** The header that says a proxy must not buffer the stream. */
const NO_BUFFERING = 'no';

/**
 * The headers a stream is opened with, whatever Nest added.
 * `connection` is not among them: Nest writes it when the
 * request is HTTP/1 and leaves it out when it is not, where it
 * would be forbidden, so the default cannot say it either.
 */
const STREAM_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-cache',
  'content-type': 'text/event-stream',
  'x-accel-buffering': NO_BUFFERING,
};

/**
 * The frames a stream holds before a writer waits for the
 * reader; Node's own object streams settle on sixteen.
 */
const HIGH_WATER_MARK = 16;

/** What Nest calls once the stream's headers are chosen. */
type CommitListener = (response: Response) => void;

/**
 * What the stream calls once its reader is gone. A platform
 * says which by cancelling the stream it was given, and nothing
 * downstream is listening for that, so whoever mounted the
 * stream is the one it has to tell.
 */
type DisconnectListener = () => void;

/**
 * What the stream says once it is open, and once it is over —
 * one record rather than three arguments, because a mount hands
 * over all three or none.
 */
interface StreamSinks {
  readonly onCommit: CommitListener;
  readonly onDisconnect: DisconnectListener;
  readonly signal: StartSignal;
}

/**
 * Says the stream started, to whoever waits on it. A callback
 * rather than an event target: the only thing anyone does with
 * the signal is wait for the one event, and an `EventTarget`
 * costs an allocation and a dispatch per request to carry it —
 * paid even on the routes that stream nothing.
 */
type StartSignal = () => void;

/** Says why a stream failed, without taking the process down. */
const logger = new Logger('SseResponse');

function toBytes(chunk: unknown): Uint8Array | undefined {
  if (typeof chunk === 'string') {
    return new TextEncoder().encode(chunk);
  }
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  return undefined;
}

class SseResponse extends Writable {
  private readonly onCommit: CommitListener;
  private readonly onDisconnect: DisconnectListener;
  private readonly signal: StartSignal;
  private readonly status: () => number | undefined;
  private readonly stream: ReadableStream<Uint8Array>;
  private controller:
    | ReadableStreamDefaultController<Uint8Array>
    | undefined;
  private waiting: StreamCallback | undefined;
  private committed = false;
  private cancelled = false;
  private headers: Record<string, string> = {};
  private answerStatus: number = DEFAULT_STATUS;

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
    // A client that walked away makes the next write fail; that
    // is the client's business, not a reason to crash.
    this.on('error', (error: Error): void => {
      this.logFailure(error);
    });
  }

  /**
   * The status Nest read from the adapter before the handler
   * ran, so `@HttpCode()` and a POST default reach the stream.
   */
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

  /**
   * Nothing is buffered here, so there is nothing to flush:
   * Hono already has the response.
   */
  public flushHeaders(): void {
    this.commit();
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Turns what Nest wrote into the Hono response, exactly once,
   * handing it over before the start event is emitted so
   * whoever waits on that event reads a live body.
   */
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

  /**
   * Hands a frame to the web stream. Once its queue is full the
   * write waits for the reader to drain it, so a producer that
   * outruns its client is slowed rather than buffered. Only one
   * write is ever held, because a writable does not take the
   * next one before this one answers.
   */
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

  private finish(): void {
    const { controller } = this;
    this.release();
    if (this.cancelled || controller === undefined) {
      return;
    }
    this.cancelled = true;
    controller.close();
  }

  private logFailure(error: Error): void {
    logger.debug(error.message);
  }

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

  public override _final(callback: StreamCallback): void {
    this.finish();
    callback();
  }

  public override _destroy(
    error: Error | null,
    callback: StreamCallback,
  ): void {
    this.finish();
    callback(error);
  }
}

export { SseResponse };
export type { CommitListener, StartSignal };

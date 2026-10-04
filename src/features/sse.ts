import { once } from 'node:events';
import { Writable } from 'node:stream';

import { Logger } from '@nestjs/common';

import type { NestContext } from '../core/context.ts';

/** The callback every Node stream write and finalizer takes. */
type StreamCallback = (error?: Error | null) => void;

/** The status an event stream answers with when Nest names none. */
const DEFAULT_STATUS = 200;

/** The event a stream emits once its headers are on the wire. */
const STARTED = 'started';

/** The header that says a proxy must not buffer the stream. */
const NO_BUFFERING = 'no';

/** The headers a stream is opened with, whatever Nest added. */
const STREAM_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'content-type': 'text/event-stream',
  'x-accel-buffering': NO_BUFFERING,
};

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

/** What Nest calls once the stream's headers are chosen. */
type CommitListener = (response: Response) => void;

/**
 * The Node writable Nest pipes an event stream into, and the
 * web stream the Hono response reads its frames from.
 *
 * Nest answers `@Sse()` through `SseStream`, a `Transform` that
 * is piped onto the response object. That object has to be a
 * genuine `Writable`, so this one collects what Nest writes and
 * hands the same bytes to a `ReadableStream`, which becomes the
 * Hono response the client reads. The members Nest touches
 * around the pipe — the status, the headers, the flushing and
 * the end — are all here, so it needs nothing from Node's own
 * `ServerResponse`. A client that walks away cancels the web
 * stream, and the writes that follow are dropped rather than
 * thrown at the process.
 */
class SseResponse extends Writable {
  private readonly onCommit: CommitListener;
  private readonly status: () => number | undefined;
  private readonly stream: ReadableStream<Uint8Array>;
  private controller:
    | ReadableStreamDefaultController<Uint8Array>
    | undefined;
  private committed = false;
  private cancelled = false;
  private headers: Record<string, string> = {};
  private answerStatus: number = DEFAULT_STATUS;

  public constructor(
    status: () => number | undefined,
    onCommit: CommitListener,
  ) {
    super();
    this.status = status;
    this.onCommit = onCommit;
    this.stream = new ReadableStream<Uint8Array>({
      cancel: (): void => {
        this.cancelled = true;
      },
      start: (controller): void => {
        this.controller = controller;
      },
    });
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
   * Nothing is buffered here, so there is nothing left to
   * flush: Hono already has the response by the time Nest
   * asks.
   */
  public flushHeaders(): void {
    this.commit();
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Turns what Nest wrote into the Hono response, exactly once.
   * The response is handed over before the start event is
   * emitted, so whoever waits on the event reads a live body.
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
  }

  private enqueue(chunk: Uint8Array): void {
    const { controller } = this;
    if (this.cancelled || controller === undefined) {
      return;
    }
    controller.enqueue(chunk);
  }

  private finish(): void {
    const { controller } = this;
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
    this.enqueue(bytes);
    callback();
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

/** The headers Hono already recorded for the answer. */
function recordedHeaders(
  context: NestContext,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [name, value] of context.res.headers) {
    if (name !== 'content-type') {
      record[name] = value;
    }
  }
  return record;
}

/**
 * Gives the object Nest reads as its response the surface its
 * SSE path touches, so the same object serves every supported
 * Nest major.
 *
 * Nest 11 and 12 both prefer `res.raw` when it is set, and Nest
 * 12 never reads the response's own members then. Pointing
 * `raw` at this writable is what keeps the frames travelling
 * through Hono: writing them straight into `c.env.outgoing`
 * would bypass the `Response` this adapter returns, and the
 * transport would then write that response into the same socket
 * a second time. `req.raw` is the real incoming message, which
 * is what tunes the socket and reports a disconnect.
 */
function installSurface(
  context: NestContext,
  response: SseResponse,
): void {
  Object.defineProperties(context, {
    raw: { configurable: true, value: response },
    statusCode: {
      configurable: true,
      get: (): number | undefined => response.statusCode,
    },
    writableEnded: {
      configurable: true,
      get: (): boolean => response.writableEnded,
    },
  });
  Object.assign(context, {
    emit: response.emit.bind(response),
    end: response.end.bind(response),
    flushHeaders: response.flushHeaders.bind(response),
    getHeaders: (): Record<string, string> =>
      recordedHeaders(context),
    on: response.on.bind(response),
    once: response.once.bind(response),
    removeListener: response.removeListener.bind(response),
    setHeader: response.setHeader.bind(response),
    write: response.write.bind(response),
    writeHead: response.writeHead.bind(response),
  });
}

/**
 * Opens an event stream on the response Nest reads, and says
 * when it started. The stream is the destination `SseStream`
 * pipes into, so nothing is buffered until Nest commits the
 * headers, which is also the moment the promise settles.
 */
function mountSse(
  context: NestContext,
  status: () => number | undefined,
): Promise<unknown> {
  const response = new SseResponse(status, (answer): void => {
    context.res = answer;
  });
  installSurface(context, response);
  return once(response, STARTED) as Promise<unknown>;
}

export { SseResponse, mountSse };

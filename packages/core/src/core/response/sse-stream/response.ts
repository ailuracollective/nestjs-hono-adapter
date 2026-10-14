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

class SseResponse extends Writable {
  private readonly onCommit: CommitListener;
  private readonly onDisconnect: DisconnectListener;
  private readonly signal: StartSignal;
  private readonly status: () => number | undefined;
  private readonly stream: ReadableStream<Uint8Array>;
  private controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  private waiting: StreamCallback | undefined;
  private committed = false;
  private cancelled = false;
  private headers: Record<string, string> = {};
  private answerStatus: number = DEFAULT_STATUS;

  public constructor(status: () => number | undefined, sinks: StreamSinks) {
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

  public get statusCode(): number | undefined {
    return this.status();
  }

  public writeHead(status: number, headers?: Record<string, string>): this {
    this.answerStatus = status;
    this.headers = headers ?? {};
    this.commit();
    return this;
  }

  public flushHeaders(): void {
    this.commit();
  }

  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  private commit(): void {
    if (this.committed) return;
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

  private enqueue(chunk: Uint8Array, callback: StreamCallback): void {
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

  private release(): void {
    const { waiting } = this;
    this.waiting = undefined;
    if (waiting !== undefined) waiting();
  }

  private finish(): void {
    const { controller } = this;
    this.release();
    if (this.cancelled || controller === undefined) return;
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
      callback(new TypeError('An event stream carries bytes only.'));
      return;
    }
    this.enqueue(bytes, callback);
  }

  public override _final(callback: StreamCallback): void {
    this.finish();
    callback();
  }

  public override _destroy(error: Error | null, callback: StreamCallback): void {
    this.finish();
    callback(error);
  }
}

export { SseResponse };

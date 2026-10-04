import { setTimeout as delay } from 'node:timers/promises';

import { expect, test } from 'bun:test';
import {
  Controller,
  ForbiddenException,
  Header,
  HttpStatus,
  Module,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  Observable,
  Subject,
  firstValueFrom,
  of,
  throwError,
  timeout,
} from 'rxjs';

import { mountStream, startProbe } from './probe.ts';

/** How long the second frame of the slow route waits. */
const SECOND_FRAME_DELAY = 300;

/** How long a frame is given to arrive before a case fails. */
const FRAME_TIMEOUT = 3000;

/** How often the open route ticks while the client listens. */
const TICK_INTERVAL = 10;

/** Says when the open route was torn down. */
let torn: Subject<void> = new Subject<void>();

/** One decoded chunk of an event stream, and when it arrived. */
interface Snapshot {
  readonly at: number;
  readonly text: string;
}

/** What one read of a response body answered. */
interface BodyChunk {
  readonly done: boolean;
  readonly value: Uint8Array | undefined;
}

/** The one read a case needs from the body of a response. */
interface BodyReader {
  readonly read: () => Promise<BodyChunk>;
}

/** Everything one drain of a stream carries between its steps. */
interface Drain {
  readonly deadline: number;
  readonly reader: BodyReader;
  readonly snapshots: Snapshot[];
  text: string;
}

const decoder = new TextDecoder();

/** Fails a case instead of hanging it when nothing arrives. */
async function failAfter(ms: number): Promise<never> {
  await delay(ms, undefined, { ref: false });
  throw new Error('The event stream did not answer in time.');
}

/** Reads one chunk, or fails once the deadline passed. */
function nextChunk(
  reader: BodyReader,
  deadline: number,
): Promise<BodyChunk> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error('The event stream did not answer in time.');
  }
  return Promise.race([reader.read(), failAfter(remaining)]);
}

/**
 * Reads until the stream ends, remembering what the whole text
 * looked like before each chunk, so a case can tell when the
 * first frame arrived rather than only that it did.
 */
async function drain(
  state: Drain,
): Promise<readonly Snapshot[]> {
  const chunk = await nextChunk(state.reader, state.deadline);
  if (chunk.done) {
    return state.snapshots;
  }
  const { value } = chunk;
  if (value !== undefined) {
    state.text += decoder.decode(value);
    state.snapshots.push({ at: Date.now(), text: state.text });
  }
  return drain(state);
}

/** Reads every chunk of a stream, with the time each arrived. */
function collect(
  body: ReadableStream<Uint8Array>,
  ms: number,
): Promise<readonly Snapshot[]> {
  return drain({
    deadline: Date.now() + ms,
    reader: body.getReader(),
    snapshots: [],
    text: '',
  });
}

/** The whole text one collection produced. */
function framesOf(snapshots: readonly Snapshot[]): string {
  let text = '';
  for (const { text: frame } of snapshots) {
    text = frame;
  }
  return text;
}

/** The first snapshot that carried the text looked for. */
function arrivalOf(
  snapshots: readonly Snapshot[],
  needle: string,
): Snapshot {
  const found = snapshots.find((snapshot) =>
    snapshot.text.includes(needle),
  );
  if (found === undefined) {
    throw new Error(`The stream never wrote ${needle}.`);
  }
  return found;
}

/** Reads one frame, so a disconnect can be issued mid-stream. */
async function readOnce(
  reader: BodyReader,
  ms: number,
): Promise<string> {
  const chunk = await nextChunk(reader, Date.now() + ms);
  if (chunk.done || chunk.value === undefined) {
    throw new Error('The stream ended before a frame arrived.');
  }
  return decoder.decode(chunk.value);
}

/** The body of a response, or a failure when there is none. */
function bodyOf(
  response: Response,
): ReadableStream<Uint8Array> {
  const { body } = response;
  if (body === null) {
    throw new TypeError('The response has no streamed body.');
  }
  return body;
}

/**
 * Opens a stream and reads its first frame, so a case can then
 * walk away from a live stream.
 */
async function openStream(
  origin: string,
  route: string,
): Promise<AbortController> {
  const client = new AbortController();
  const response = await fetch(`${origin}${route}`, {
    signal: client.signal,
  });
  await readOnce(bodyOf(response).getReader(), FRAME_TIMEOUT);
  return client;
}

/** Fetches one route and reads the whole stream it answers. */
async function streamText(
  origin: string,
  route: string,
): Promise<string> {
  const response = await fetch(`${origin}${route}`);
  return framesOf(
    await collect(bodyOf(response), FRAME_TIMEOUT),
  );
}

/**
 * The routes every case streams from: one that answers at its
 * own pace, one that names every frame field, one that answers
 * through a promise, two that fail, and one that never ends.
 */
@Controller()
class SseController {
  @Sse('sse/slow')
  public slow(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'first' });
      const timer = setTimeout(() => {
        subscriber.next({ data: 'second' });
        subscriber.complete();
      }, SECOND_FRAME_DELAY);
      return (): void => {
        clearTimeout(timer);
      };
    });
  }

  @Sse('sse/frames')
  @Header('x-stream', 'yes')
  public frames(): Observable<MessageEvent> {
    return of({
      data: { count: 1 },
      id: 'two',
      retry: 3000,
      type: 'tick',
    });
  }

  @Sse('sse/promise')
  public promised(): Promise<Observable<MessageEvent>> {
    return Promise.resolve(of({ data: 'deferred' }));
  }

  @Sse('sse/throws')
  public throws(): Observable<MessageEvent> {
    throw new ForbiddenException('no stream');
  }

  @Sse('sse/errors')
  public errors(): Observable<MessageEvent> {
    return throwError(() => new Error('stream failed'));
  }

  @Sse('sse/broken')
  public broken(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      subscriber.error(new Error('after the frame'));
    });
  }

  @Sse('sse/open')
  public open(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: 'open' });
      const timer = setInterval(() => {
        subscriber.next({ data: 'tick' });
      }, TICK_INTERVAL);
      return (): void => {
        torn.next();
        clearInterval(timer);
      };
    });
  }
}

@Module({ controllers: [SseController] })
class SseModule {}

test('an event stream is answered incrementally', async () => {
  // A real client reads the frames, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const started = Date.now();
    const response = await fetch(`${probe.origin}/sse/slow`);
    expect(response.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    const snapshots = await collect(
      bodyOf(response),
      FRAME_TIMEOUT,
    );
    const first = arrivalOf(snapshots, 'data: first');
    expect(first.at - started).toBeLessThan(SECOND_FRAME_DELAY);
    expect(framesOf(snapshots)).toContain('data: second');
  } finally {
    await probe.close();
  }
});

test('a frame carries the data, the type, the id and the retry', async () => {
  // A real client reads the frames, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const response = await fetch(`${probe.origin}/sse/frames`);
    expect(response.headers.get('x-stream')).toBe('yes');
    const text = framesOf(
      await collect(bodyOf(response), FRAME_TIMEOUT),
    );
    expect(text).toContain('event: tick\n');
    expect(text).toContain('id: two\n');
    expect(text).toContain('retry: 3000\n');
    expect(text).toContain('data: {"count":1}\n');
  } finally {
    await probe.close();
  }
});

test('a promise of an observable is awaited', async () => {
  // A real client reads the frames, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const text = await streamText(probe.origin, '/sse/promise');
    expect(text).toContain('data: deferred');
  } finally {
    await probe.close();
  }
});

test('a handler that throws is answered by Nest', async () => {
  // A real client reads the answer, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const response = await fetch(`${probe.origin}/sse/throws`);
    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.headers.get('content-type')).toContain(
      'application/json',
    );
  } finally {
    await probe.close();
  }
});

test('an observable that errors before a frame is answered by Nest', async () => {
  // A real client reads the answer, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const response = await fetch(`${probe.origin}/sse/errors`);
    expect(response.status).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    await probe.close();
  }
});

test('a stream that errors after a frame ends with an error event', async () => {
  // A real client reads the frames, so this probe listens.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  try {
    const response = await fetch(`${probe.origin}/sse/broken`);
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    const text = await streamText(probe.origin, '/sse/broken');
    expect(text).toContain('data: open');
    expect(text).toContain('event: error\n');
    expect(text).toContain('after the frame');
  } finally {
    await probe.close();
  }
});

test('a client that walks away unsubscribes the handler', async () => {
  torn = new Subject<void>();
  // The handler has to notice a client leaving a real socket.
  const probe = await startProbe({
    mode: 'socket',
    module: SseModule,
  });
  const client = await openStream(probe.origin, '/sse/open');
  try {
    client.abort();
    await firstValueFrom(torn.pipe(timeout(FRAME_TIMEOUT)));
    // The next request is served as if the first one never ran.
    const text = await streamText(probe.origin, '/sse/frames');
    expect(text).toContain('data: {"count":1}');
  } finally {
    await probe.close();
  }
});

test('closing the application while a stream is open settles', async () => {
  // Closing has to reach a connection that is really open.
  const probe = await startProbe({
    application: { forceCloseConnections: true },
    mode: 'socket',
    module: SseModule,
  });
  const client = await openStream(probe.origin, '/sse/open');
  try {
    await Promise.race([
      probe.close(),
      failAfter(FRAME_TIMEOUT),
    ]);
  } finally {
    client.abort();
  }
  // A second close must settle the same way the first one did.
  await probe.close();
});

test('the bridge opens the interceptor given it', async () => {
  const reads: number[] = [];
  const probe = await startProbe({ module: SseModule });
  const answer = await mountStream(probe, (context, status) => {
    reads.push(status() ?? 0);
    context.res = new Response('mounted', {
      status: HttpStatus.CREATED,
    });
    return Promise.resolve();
  });
  try {
    expect(reads).toStrictEqual([HttpStatus.ACCEPTED]);
    expect(answer.status).toBe(HttpStatus.CREATED);
    expect(answer.text).toBe('mounted');
  } finally {
    await probe.close();
  }
});

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';

import type { NodeEnv } from '../src/index.ts';
import type { Probe } from './probe.ts';
import {
  FLOOD_FRAMES,
  SECOND_FRAME_DELAY,
  SseModule,
  startProbe,
  torn,
} from './support.ts';

/** How long a frame is given to arrive before a case fails. */
const FRAME_TIMEOUT = 3000;

/** How long the flood route runs ahead of a stalled reader. */
const FLOOD_DELAY = 100;

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
 * Opens a stream on the probe's own connection and reads its
 * first frame, so a case can then walk away from a live
 * stream.
 *
 * Only a socket probe can do this. The case needs a client that
 * really disconnects, and an in-process probe has no client to
 * disconnect: its faked socket never fires `close`.
 */
async function openStream(
  probe: Probe,
  route: string,
): Promise<AbortController> {
  const client = new AbortController();
  const response = await probe.respond(route, {
    signal: client.signal,
  });
  await readOnce(bodyOf(response).getReader(), FRAME_TIMEOUT);
  return client;
}

/** Asks one route and reads the whole stream it answers. */
async function streamText(
  probe: Probe,
  route: string,
): Promise<string> {
  const response = await probe.respond(route);
  return framesOf(
    await collect(bodyOf(response), FRAME_TIMEOUT),
  );
}

/** A probe with no listener, no port and no teardown. */
function streamedProbe(): Promise<Probe> {
  return startProbe({ mode: 'in-process', module: SseModule });
}

test('an event stream is answered incrementally', async () => {
  const probe = await streamedProbe();
  try {
    const started = Date.now();
    const response = await probe.respond('/sse/slow');
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
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/frames');
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
  const probe = await streamedProbe();
  try {
    const text = await streamText(probe, '/sse/promise');
    expect(text).toContain('data: deferred');
  } finally {
    await probe.close();
  }
});

test('a stalled reader is caught up whole once it reads', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/flood');
    // The producer runs ahead with nobody reading: what fits
    // in the queue is held, and the rest waits for this reader.
    await delay(FLOOD_DELAY, undefined, { ref: false });
    const text = framesOf(
      await collect(bodyOf(response), FRAME_TIMEOUT),
    );
    const frames = text
      .split('\n\n')
      .filter((frame) => frame.includes('data:'));
    expect(frames).toHaveLength(FLOOD_FRAMES);
    expect(frames[0]).toContain(
      `data: ${JSON.stringify({ count: 0 })}`,
    );
    expect(text).toContain(
      `data: ${JSON.stringify({ count: FLOOD_FRAMES - 1 })}`,
    );
  } finally {
    await probe.close();
  }
});

test('a stream that errors after a frame ends with an error event', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/broken');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    const text = await streamText(probe, '/sse/broken');
    expect(text).toContain('data: open');
    expect(text).toContain('event: error\n');
    expect(text).toContain('after the frame');
  } finally {
    await probe.close();
  }
});

/**
 * This case stays on the socket, and so does the one after it.
 * What each one is about is a live connection: a client that
 * really disconnects, and an application really shutting one
 * down. There is no connection for `forceCloseConnections` to
 * force and no client to walk away, so neither claim can be
 * made without a real one.
 *
 * A runtime with no connection behind it is a different case,
 * and one an in-process probe can make: what stands in for the
 * client is the request ending, or the reader letting go of the
 * stream. Those are the two cases at the end of this file.
 */
test('a client that walks away unsubscribes the handler', async () => {
  const probe = await startProbe({ module: SseModule });
  const client = await openStream(probe, '/sse/open');
  try {
    client.abort();
    await firstValueFrom(torn.pipe(timeout(FRAME_TIMEOUT)));
    // The next request is served as if the first one never ran.
    const text = await streamText(probe, '/sse/frames');
    expect(text).toContain('data: {"count":1}');
  } finally {
    await probe.close();
  }
});

test('closing the application while a stream is open settles', async () => {
  const probe = await startProbe({
    application: { forceCloseConnections: true },
    module: SseModule,
  });
  const client = await openStream(probe, '/sse/open');
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

/**
 * Sends one request over a socket of the kind a runtime with no
 * TCP socket behind it reports: the members everything else
 * reads, and none of the tuning. Cloudflare Workers reports one
 * through `cloudflare:node`, and nothing about it ever closes,
 * so a case on this path is a case about a runtime where the
 * disconnect has to arrive from somewhere else. Both are read
 * back, because both are what the runtime has left to say it
 * with.
 */
async function respondOverBareSocket(
  probe: Probe,
  path: string,
): Promise<{
  readonly incoming: IncomingMessage;
  readonly response: Response;
}> {
  const socket = new Socket();
  for (const name of [
    'setKeepAlive',
    'setNoDelay',
    'setTimeout',
  ] as const) {
    Reflect.set(socket, name, undefined);
  }
  const incoming = new IncomingMessage(socket);
  const binding = {
    incoming,
    outgoing: new ServerResponse(incoming),
  } satisfies NodeEnv['Bindings'];
  const response = await probe.adapter
    .getHono()
    .request(path, undefined, binding);
  return { incoming, response };
}

test('a request that ends unsubscribes the handler', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: SseModule,
  });
  try {
    const { incoming } = await respondOverBareSocket(
      probe,
      '/sse/open',
    );
    // The wait is armed first: the subject does not replay,
    // and this disconnect is issued in the same tick.
    const gone = firstValueFrom(
      torn.pipe(timeout(FRAME_TIMEOUT)),
    );
    // What a platform with no socket to close says instead.
    incoming.emit('close');
    await gone;
  } finally {
    await probe.close();
  }
});

test('a reader that lets go unsubscribes the handler', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: SseModule,
  });
  try {
    const { response } = await respondOverBareSocket(
      probe,
      '/sse/open',
    );
    const gone = firstValueFrom(
      torn.pipe(timeout(FRAME_TIMEOUT)),
    );
    await bodyOf(response).cancel();
    await gone;
  } finally {
    await probe.close();
  }
});

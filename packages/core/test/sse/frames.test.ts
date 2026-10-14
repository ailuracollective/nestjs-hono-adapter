import { expect, test } from 'bun:test';

import { SECOND_FRAME_DELAY } from '#adapter-test/support/index';
import { FRAME_TIMEOUT, bodyOf, collect, framesOf, streamText, streamedProbe } from './support.ts';
import type { Snapshot } from './support.ts';

const arrivalOf = (snapshots: readonly Snapshot[], needle: string): Snapshot => {
  const found = snapshots.find((snapshot) => snapshot.text.includes(needle));
  if (found === undefined) {
    throw new Error(`The stream never wrote ${needle}.`);
  }
  return found;
};

test('an event stream is answered incrementally', async () => {
  const probe = await streamedProbe();
  try {
    const started = Date.now();
    const response = await probe.respond('/sse/slow');
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const snapshots = await collect(bodyOf(response), FRAME_TIMEOUT);
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
    const text = framesOf(await collect(bodyOf(response), FRAME_TIMEOUT));
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

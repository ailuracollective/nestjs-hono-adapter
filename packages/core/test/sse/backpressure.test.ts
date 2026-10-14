import { setTimeout as delay } from 'node:timers/promises';

import { expect, test } from 'bun:test';

import { FLOOD_FRAMES } from '#adapter-test/support/index';
import { FRAME_TIMEOUT, bodyOf, collect, framesOf, streamedProbe } from './support.ts';

const FLOOD_DELAY = 100;

test('a stalled reader is caught up whole once it reads', async () => {
  const probe = await streamedProbe();
  try {
    const response = await probe.respond('/sse/flood');
    await delay(FLOOD_DELAY, undefined, { ref: false });
    const text = framesOf(await collect(bodyOf(response), FRAME_TIMEOUT));
    const frames = text.split('\n\n').filter((frame) => frame.includes('data:'));
    expect(frames).toHaveLength(FLOOD_FRAMES);
    expect(frames[0]).toContain(`data: ${JSON.stringify({ count: 0 })}`);
    expect(text).toContain(`data: ${JSON.stringify({ count: FLOOD_FRAMES - 1 })}`);
  } finally {
    await probe.close();
  }
});

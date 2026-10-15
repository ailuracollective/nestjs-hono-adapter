import { expect, test } from 'bun:test';

import { Hono } from 'hono';

import { streamText, streamedProbe } from './support.ts';

test('a stream does not fit itself onto every Hono context in the process', async () => {
  const probe = await streamedProbe();
  try {
    await streamText(probe, '/sse/broken');
    const foreign = new Hono();
    foreign.get('/x', (context) => context.json({ carries: 'raw' in context }));
    const answer = await foreign.request('/x');
    const body: unknown = await answer.json();
    expect(body).toStrictEqual({ carries: false });
  } finally {
    await probe.close();
  }
});

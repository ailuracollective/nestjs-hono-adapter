import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { streamText, streamedProbe } from './support.ts';

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

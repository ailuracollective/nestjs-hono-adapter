import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';
import { jsonRequest, startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from './fixture.ts';

// `body-parser` asks `on-finished` (which reads `req.complete` / `req.readable`) whether to read;
// the adapter already drained the body, so the request must report the carrier's real state.

test('the request reports the carrier as finished once the body is read', async () => {
  const probe = await startAdapter(nodeAdapter());
  try {
    const response = await request(probe, '/carrier', jsonRequest({ hello: 'world' }));
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ complete: true, readable: false });
  } finally {
    await probe.close();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';
import { jsonRequest, startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from './fixture.ts';

// A body the adapter has not read is still there: the carrier may be drained (the web wrapper read
// it) while the request body waits, and reporting that as "not readable" makes a body parser bail
// instead of reading it.
test('a body the adapter has not read is reported as readable', async () => {
  const probe = await startAdapter(nodeAdapter(), { application: { bodyParser: false } });
  try {
    const response = await request(probe, '/carrier', jsonRequest({ hello: 'world' }));
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toMatchObject({ readable: true });
  } finally {
    await probe.close();
  }
});

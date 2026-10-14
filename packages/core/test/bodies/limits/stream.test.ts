import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { jsonRequest, startAdapter, startProbe } from '#adapter-test/support/index';
import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';
import { BODY_LIMIT } from '#adapter-test/bodies/support';

test('a cached body without a declared length still obeys the limit', async () => {
  const adapter = bunAdapter({ bodyLimit: BODY_LIMIT });
  adapter.getHono().use('*', async (context, next) => {
    await context.req.arrayBuffer();
    return next();
  });
  const probe = await startAdapter(adapter, {
    mode: 'in-process',
  });
  try {
    const response = await request(
      probe,
      '/echo',
      jsonRequest({
        text: 'x'.repeat(BODY_LIMIT + BODY_LIMIT),
      }),
    );
    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  } finally {
    await probe.close();
  }
});

test('a body over a declared limit is refused before it is read', async () => {
  const probe = await startProbe({
    adapter: { bodyLimit: BODY_LIMIT },
    mode: 'in-process',
  });
  try {
    const response = await request(
      probe,
      '/echo',
      jsonRequest({
        text: 'x'.repeat(BODY_LIMIT + BODY_LIMIT),
      }),
    );
    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  } finally {
    await probe.close();
  }
});

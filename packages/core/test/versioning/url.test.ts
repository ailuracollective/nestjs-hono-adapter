import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { MEDIA_PATH, MEDIA_TYPE_PROBE } from '#adapter-test/versioning-fixture';
import { accept } from './helpers.ts';

test.each([
  'application/json;v=1',
  'application/json;q=0.8;v=2',
  'text/html, application/json;v=2',
  'text/html;q=0.9, application/json;v=2',
])('a version at any position in the accept header reaches its route', async (header) => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(probe, MEDIA_PATH, accept(header));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: header.includes('v=1') ? '1' : '2' });
  } finally {
    await probe.close();
  }
});

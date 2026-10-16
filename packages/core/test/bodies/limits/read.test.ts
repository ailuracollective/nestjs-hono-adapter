import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { toByteLimit } from '#adapter/core/request/body/index';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';
import { BODY_LIMIT } from '#adapter-test/bodies/support';

import { BYTES_LIMIT, CHUNK, KIB, LOOKAHEAD_CHUNKS, chunkedBody } from './fixture.ts';

test('a body that declares no length is refused while it is read', async () => {
  const stream = chunkedBody();
  const probe = await startProbe({
    adapter: { bodyLimit: BODY_LIMIT },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: stream.body,
      duplex: 'half',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(stream.pulled()).toBeLessThanOrEqual(LOOKAHEAD_CHUNKS * CHUNK);
    expect(stream.pulled()).toBeLessThan(stream.total);
  } finally {
    await probe.close();
  }
});

test('a limit is read the way Nest reads it', () => {
  expect(toByteLimit('1kb')).toBe(KIB);
  expect(toByteLimit('1mb')).toBe(KIB * KIB);
  expect(toByteLimit(BYTES_LIMIT)).toBe(BYTES_LIMIT);
  expect(() => toByteLimit('soon')).toThrow(TypeError);
});

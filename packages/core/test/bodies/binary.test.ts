import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { jsonRequest, startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

const BINARY_LENGTH = 4;

test('a binary payload reaches the handler as bytes', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/binary', {
      body: new Uint8Array(BINARY_LENGTH),
      headers: { 'content-type': 'application/octet-stream' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      bytes: BINARY_LENGTH,
    });
  } finally {
    await probe.close();
  }
});

test('rawBody keeps the bytes when the application asks for them', async () => {
  const probe = await startProbe({
    application: { rawBody: true },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/raw', jsonRequest({ name: 'note' }));
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      raw: '{"name":"note"}',
    });
  } finally {
    await probe.close();
  }
});

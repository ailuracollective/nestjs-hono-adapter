import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ResponseModule } from '#adapter-test/response-fixture';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a StreamableFile is streamed with its headers', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/file');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/plain');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="note.txt"');
    expect(response.text).toBe('streamed');
  } finally {
    await probe.close();
  }
});

test('a declared content type wins over the inferred one', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/declared-type');
    expect(response.contentType).toBe('application/xml');
  } finally {
    await probe.close();
  }
});

test('a value with no declared type is answered as JSON', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/inferred-type');
    expect(response.contentType).toBe('application/json; charset=UTF-8');
    expect(response.body).toStrictEqual({ inferred: 'json' });
  } finally {
    await probe.close();
  }
});

test('a declared content type is honoured on a string body', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/declared-type-text');
    expect(response.contentType).toBe('text/csv');
    expect(response.text).toBe('a,b');
  } finally {
    await probe.close();
  }
});

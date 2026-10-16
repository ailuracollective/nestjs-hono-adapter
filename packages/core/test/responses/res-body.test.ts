import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ResponseModule } from '#adapter-test/response-fixture';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

test('a handler that answers through @Res() writes its response', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/imperative');
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      imperative: true,
    });
  } finally {
    await probe.close();
  }
});

test('an ordinary @Res() route is not answered as an event stream', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/writer');
    expect(response.contentType).not.toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBeNull();
    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.get('x-accel-buffering')).toBeNull();
  } finally {
    await probe.close();
  }
});

test('raw bytes are answered as a binary body', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/bytes');
    expect(response.contentType).toBe('application/octet-stream');
    expect(response.text).toBe('raw');
  } finally {
    await probe.close();
  }
});

test('a passthrough @Res() keeps the headers it set', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/passthrough');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('x-passthrough')).toBe('yes');
    expect(response.body).toStrictEqual({
      passthrough: true,
    });
  } finally {
    await probe.close();
  }
});

test('@Header() and @HttpCode() reach the answer', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ResponseModule,
  });
  try {
    const response = await request(probe, '/response/decorated');
    expect(response.status).toBe(HttpStatus.ACCEPTED);
    expect(response.headers.get('x-decorated')).toBe('yes');
  } finally {
    await probe.close();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from './support.ts';

test('a handler that answers through @Res() writes its response', async () => {
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/response/imperative',
    );
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      imperative: true,
    });
  } finally {
    await probe.close();
  }
});

test('a passthrough @Res() keeps the headers it set', async () => {
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/response/passthrough',
    );
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
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/response/decorated',
    );
    expect(response.status).toBe(HttpStatus.ACCEPTED);
    expect(response.headers.get('x-decorated')).toBe('yes');
  } finally {
    await probe.close();
  }
});

test('@Redirect() answers with the status and the location', async () => {
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/response/redirect',
      { redirect: 'manual' },
    );
    expect(response.status).toBe(HttpStatus.MOVED_PERMANENTLY);
    expect(response.headers.get('location')).toBe(
      'https://example.com/',
    );
  } finally {
    await probe.close();
  }
});

test('a StreamableFile is streamed with its headers', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/response/file');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/plain');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="note.txt"',
    );
    expect(response.text).toBe('streamed');
  } finally {
    await probe.close();
  }
});

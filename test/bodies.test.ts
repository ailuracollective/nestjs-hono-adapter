import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { toByteLimit } from '../src/core/body.ts';
import { jsonRequest, request, startProbe } from './probe.ts';
import { MarkerFilter } from './support.ts';

/** A limit small enough that one longer body crosses it. */
const BODY_LIMIT = 16;

const KIB = 1024;

/** A limit written as a plain number of bytes. */
const BYTES_LIMIT = 512;

/** As many bytes as the adapter accepts in one test. */
const BINARY_LENGTH = 4;

test('a JSON body reaches the handler that asked for it', async () => {
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/echo',
      jsonRequest({ hello: 'world' }),
    );
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ hello: 'world' });
  } finally {
    await probe.close();
  }
});

test('a JSON suffix type is read as JSON', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/echo', {
      body: JSON.stringify({ data: 'value' }),
      headers: { 'content-type': 'application/vnd.api+json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ data: 'value' });
  } finally {
    await probe.close();
  }
});

test('an empty JSON body is read as an empty object', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/echo', {
      body: '',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({});
  } finally {
    await probe.close();
  }
});

test('a form body is parsed the way a query string is', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/echo', {
      body: 'ids=1&ids=2&filter[name]=x',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      filter: { name: 'x' },
      ids: ['1', '2'],
    });
  } finally {
    await probe.close();
  }
});

test('a query string reaches @Query() with its lists', async () => {
  const probe = await startProbe();
  try {
    const response = await request(
      probe,
      '/query?ids=1&ids=2&filter[name]=x&page=3',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      filter: { name: 'x' },
      ids: ['1', '2'],
      page: '3',
    });
  } finally {
    await probe.close();
  }
});

test('a multipart request fills the body and the files', async () => {
  const probe = await startProbe();
  try {
    const form = new FormData();
    form.set('title', 'note');
    form.set(
      'upload',
      new File(['bytes'], 'note.txt', { type: 'text/plain' }),
    );
    const response = await request(probe, '/upload', {
      body: form,
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      body: { title: 'note' },
      files: ['upload'],
    });
  } finally {
    await probe.close();
  }
});

test('a binary payload reaches the handler as bytes', async () => {
  const probe = await startProbe();
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
  });
  try {
    const response = await request(
      probe,
      '/raw',
      jsonRequest({ name: 'note' }),
    );
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      raw: '{"name":"note"}',
    });
  } finally {
    await probe.close();
  }
});

test('a malformed body is answered by the exception layer', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useGlobalFilters(new MarkerFilter());
    },
  });
  try {
    const response = await request(probe, '/echo', {
      body: '{"broken":',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    expect(response.headers.get('x-filtered')).toBe('yes');
    expect(response.body).toStrictEqual({
      status: HttpStatus.BAD_REQUEST,
    });
  } finally {
    await probe.close();
  }
});

test('a body over the limit is refused before it is read', async () => {
  const probe = await startProbe({
    adapter: { bodyLimit: BODY_LIMIT },
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

test('a limit is read the way Nest reads it', () => {
  expect(toByteLimit('1kb')).toBe(KIB);
  expect(toByteLimit('1mb')).toBe(KIB * KIB);
  expect(toByteLimit(BYTES_LIMIT)).toBe(BYTES_LIMIT);
  expect(() => toByteLimit('soon')).toThrow(TypeError);
});

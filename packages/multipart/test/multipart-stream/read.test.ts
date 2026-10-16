import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { filePart } from '#multipart-test/multipart.support/parts';
import { asRecord } from '#multipart-test/multipart.support/requests';
import { request } from '#test/probe';
import { BAD_REQUEST, CREATED, SMALL_PIECES, SMALL_PIECE, TOO_LARGE } from './constants.ts';
import { answered, app, pacedBody, pacedInit, send, sendBody } from './support.ts';

describe('a streamed upload, read as it arrives', () => {
  test('the handler reads the bytes as they arrive', async () => {
    const result = await send('/read', filePart('streamed'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toMatchObject({
      file: {
        fieldname: 'file',
        mimetype: 'text/plain',
        originalname: 'a.txt',
        text: 'streamed',
      },
      hasFile: true,
    });
  });

  test('the fields before the file are parsed, the ones after are not', async () => {
    const form = new FormData();
    form.append('title', 'before');
    form.append('file', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
    form.append('after', 'later');

    const result = await send('/read', form);

    expect(result.status).toBe(CREATED);
    expect(asRecord(asRecord(result.body).body)).toEqual({
      title: 'before',
    });
  });

  test('a file in another field is refused', async () => {
    const result = await send('/read', filePart('x', { name: 'other' }));

    expect(result.status).toBe(BAD_REQUEST);
  });
});

describe('a streamed upload a route caps or filters', () => {
  test('a file over the limit fails the read, not the parse', async () => {
    const paced = pacedBody(SMALL_PIECES, SMALL_PIECE);

    const outcome = answered(await sendBody('/limited', pacedInit(paced)), 'capped upload');

    expect(outcome.status).toBe(TOO_LARGE);
  });

  test('a file the filter refuses is never handed over', async () => {
    const result = await send('/refused', filePart('x'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ hasFile: false });
  });

  test('a body that is not multipart is left to the request path', async () => {
    const probe = await app();
    try {
      const result = await request(probe, '/plain', {
        body: JSON.stringify({ title: 'json' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      expect(result.status).toBe(CREATED);
      expect(asRecord(asRecord(result.body).body)).toEqual({
        title: 'json',
      });
    } finally {
      await probe.close();
    }
  });
});

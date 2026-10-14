import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { ABORT_DEADLINE } from '#multipart-test/multipart.support/constants';
import { filePart } from '#multipart-test/multipart.support/parts';
import { withDeadline } from '#multipart-test/multipart.support/requests';
import { request } from '#test/probe';
import { CREATED, ELSEWHERE, PIECE, PIECES } from './constants.ts';
import { answered, app, pacedBody, pacedInit, sendBody } from './support.ts';

describe('an upload the handler never reads', () => {
  test('is carried away before the answer', async () => {
    const paced = pacedBody(PIECES, PIECE);

    const outcome = answered(await sendBody('/unread', pacedInit(paced)), 'unread upload');

    expect(outcome.status).toBe(CREATED);
    expect(paced.finished()).toBe(true);
  });

  test('is carried away before an answer that is a file of its own', async () => {
    const paced = pacedBody(PIECES, PIECE);

    const outcome = answered(
      await sendBody('/elsewhere', pacedInit(paced)),
      'answer with a file of its own',
    );

    expect(outcome.status).toBe(CREATED);
    expect(outcome.text).toBe(ELSEWHERE);
    expect(paced.finished()).toBe(true);
  });
});

describe('an answer that streams the upload back', () => {
  test('is not cut short by the discard', async () => {
    const content = 'e'.repeat(PIECES * PIECE);
    const probe = await app();
    try {
      const call = request(probe, '/echo', {
        body: filePart(content),
        method: 'POST',
      });
      const outcome = answered(await withDeadline(call, ABORT_DEADLINE), 'streamed answer');

      expect(outcome.status).toBe(CREATED);
      expect(outcome.text).toBe(content);
    } finally {
      await probe.close();
    }
  });
});

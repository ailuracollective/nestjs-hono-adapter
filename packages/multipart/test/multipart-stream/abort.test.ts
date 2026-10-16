import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { abortingBody } from '#multipart-test/multipart.support/requests';
import { BAD_REQUEST, BOUNDARY } from './constants.ts';
import { answered, sendBody } from './support.ts';

describe('a streamed upload a client abandons', () => {
  test('the read fails and the request still answers', async () => {
    const outcome = answered(
      await sendBody('/read', {
        body: abortingBody(BOUNDARY),
        duplex: 'half',
        headers: {
          'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
        },
        method: 'POST',
      }),
      'aborted upload',
    );

    expect(outcome.status).toBeGreaterThanOrEqual(BAD_REQUEST);
  });
});

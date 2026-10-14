import { expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';
import { promisify } from 'node:util';
import { deflate, gzip } from 'node:zlib';

import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

/** The JSON body every case compresses. */
const JSON_BODY = Buffer.from('{"a":1}');

/** Compresses the body the way the case names. */
const compressed = (encoding: string): Promise<Buffer> =>
  encoding === 'gzip'
    ? promisify(gzip)(JSON_BODY)
    : promisify(deflate)(JSON_BODY);

test.each(['gzip', 'deflate'])(
  'a %s body is refused with 415',
  async (encoding) => {
    const probe = await startProbe({ mode: 'in-process' });
    try {
      const response = await request(probe, '/echo', {
        body: await compressed(encoding),
        headers: {
          'content-encoding': encoding,
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      expect(response.status).toBe(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    } finally {
      await probe.close();
    }
  },
);

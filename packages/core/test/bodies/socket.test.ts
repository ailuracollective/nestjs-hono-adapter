import { expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

const JSON_BODY = '{"hello":"world"}';

interface DeclaredCase {
  readonly body: Uint8Array;
  readonly headers: Record<string, string>;
  readonly name: string;
  readonly status: number;
  readonly value?: unknown;
}

const declaredCases = async (): Promise<DeclaredCase[]> => [
  {
    body: Buffer.from(JSON_BODY, 'utf16le').swap16(),
    headers: {
      'content-type': 'application/json; charset=utf-16be',
    },
    name: 'a UTF-16BE JSON body is decoded',
    status: HttpStatus.CREATED,
    value: { hello: 'world' },
  },
  {
    body: Buffer.from(JSON_BODY, 'utf16le'),
    headers: {
      'content-type': 'application/json; charset=utf-16le',
    },
    name: 'a UTF-16LE JSON body is decoded',
    status: HttpStatus.CREATED,
    value: { hello: 'world' },
  },
  {
    body: Buffer.from(JSON_BODY),
    headers: {
      'content-type': 'application/json; charset=iso-8859-1',
    },
    name: 'a charset outside the UTF family is refused',
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  },
  {
    body: await promisify(gzip)(Buffer.from(JSON_BODY)),
    headers: {
      'content-encoding': 'gzip',
      'content-type': 'application/json',
    },
    name: 'a body it would have to inflate is refused',
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  },
];

test('a socket reader honours what the payload declares', async () => {
  const probe = await startProbe({ mode: 'socket' });
  try {
    const cases = await declaredCases();
    const answers = await Promise.all(
      cases.map(async (item) => ({
        item,
        response: await request(probe, '/echo', {
          body: item.body,
          headers: item.headers,
          method: 'POST',
        }),
      })),
    );
    for (const { item, response } of answers) {
      expect(response.status).toBe(item.status);
      if (item.value !== undefined) expect(response.body).toStrictEqual(item.value);
    }
  } finally {
    await probe.close();
  }
});

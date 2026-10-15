import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { startProbe } from '#adapter-test/support/index';

const DIGEST_LENGTH = 27;

const HEX_RADIX = 16;

// The tag Express's `etag` package builds: the length in hex, a dash, and a truncated sha1.
const tagOf = (body: string): string => {
  const digest = createHash('sha1').update(body).digest('base64').slice(0, DIGEST_LENGTH);
  const length = new TextEncoder().encode(body).byteLength.toString(HEX_RADIX);
  return `"${length}-${digest}"`;
};

test('a read carries the entity tag of its body, and a client that has it gets 304', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.set('etag', 'strong');
    },
  });
  try {
    const first = await request(probe, '/ping');
    expect(first.status).toBe(HttpStatus.OK);
    const tag = first.headers.get('etag');
    expect(tag).toBe(tagOf(first.text));

    const cached = await request(probe, '/ping', {
      headers: { 'if-none-match': tag ?? '' },
    });
    expect(cached.status).toBe(HttpStatus.NOT_MODIFIED);
    expect(cached.text).toBe('');
  } finally {
    await probe.close();
  }
});

test('a weak setting prefixes the tag', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.set('etag', 'weak');
    },
  });
  try {
    const response = await request(probe, '/ping');
    const tag = response.headers.get('etag');
    expect(tag === null ? '' : tag.startsWith('W/"')).toBe(true);
  } finally {
    await probe.close();
  }
});

test('no setting means no tag', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/ping');
    expect(response.headers.get('etag')).toBeNull();
  } finally {
    await probe.close();
  }
});

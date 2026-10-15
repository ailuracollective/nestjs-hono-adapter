import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { startProbe } from '#adapter-test/support/index';

const SHAPE = /^(?<weak>W\/)?"[0-9a-f]+-[0-9a-f]+"$/u;

test('a read carries an opaque entity tag, the same one for the same body', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.set('etag', 'strong');
    },
  });
  try {
    const first = await request(probe, '/ping');
    expect(first.status).toBe(HttpStatus.OK);
    const tag = first.headers.get('etag');
    expect(tag ?? '').toMatch(SHAPE);

    const again = await request(probe, '/ping');
    expect(again.headers.get('etag')).toBe(tag);
  } finally {
    await probe.close();
  }
});

test('a client that already holds the tag is answered 304', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.set('etag', 'strong');
    },
  });
  try {
    const first = await request(probe, '/ping');
    const cached = await request(probe, '/ping', {
      headers: { 'if-none-match': first.headers.get('etag') ?? '' },
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
    expect((tag ?? '').startsWith('W/"')).toBe(true);
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

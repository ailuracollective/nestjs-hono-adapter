import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import {
  HEADER_PATH,
  HEADER_PROBE,
  MEDIA_PATH,
  MEDIA_TYPE_PROBE,
  VERSION_HEADER,
} from '#adapter-test/versioning-fixture';
import { accept, carrying } from './helpers.ts';

test('a version in a named header reaches its route', async () => {
  const probe = await startProbe(HEADER_PROBE);
  try {
    const response = await request(probe, HEADER_PATH, carrying(VERSION_HEADER, '1'));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '1' });
  } finally {
    await probe.close();
  }
});

test('a version named in the header is the only one that route answers', async () => {
  const probe = await startProbe(HEADER_PROBE);
  try {
    const response = await request(probe, HEADER_PATH, accept('application/json;v=1'));
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a route that is neutral beside a named version answers either', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const named = await request(probe, `${MEDIA_PATH}/list`, accept('application/json;v=1'));
    expect(named.status).toBe(HttpStatus.OK);
    expect(named.body).toStrictEqual({
      served: 'neutral-or-1',
    });
    const none = await request(probe, `${MEDIA_PATH}/list`, accept('application/json'));
    expect(none.status).toBe(HttpStatus.OK);
    expect(none.body).toStrictEqual({ served: 'neutral-or-1' });
  } finally {
    await probe.close();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { MEDIA_PATH, MEDIA_TYPE_PROBE } from '#adapter-test/versioning-fixture';
import { accept } from './helpers.ts';

test('a version in the first parameter of the first range reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(probe, MEDIA_PATH, accept('application/json;v=1'));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '1' });
  } finally {
    await probe.close();
  }
});

test('a version behind another parameter reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(probe, MEDIA_PATH, accept('application/json;q=0.8;v=2'));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

test('a version in a range behind the first reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(probe, MEDIA_PATH, accept('text/html, application/json;v=2'));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

test('a version behind a parameter of an earlier range reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('text/html;q=0.9, application/json;v=2'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import {
  MEDIA_PATH,
  MEDIA_TYPE_PROBE,
  PLUS_KEY_PROBE,
} from '#adapter-test/versioning-fixture';
import { accept } from './helpers.ts';

test('a request naming no version is passed on to the next route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('application/json'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: 'neutral' });
  } finally {
    await probe.close();
  }
});

test('a version no route serves is passed on rather than refused', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      `${MEDIA_PATH}/list`,
      accept('application/json;v=9'),
    );
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a request naming no version header at all is passed on', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(probe, MEDIA_PATH);
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: 'neutral' });
  } finally {
    await probe.close();
  }
});

test('a key written with a trailing plus names the same parameter', async () => {
  const probe = await startProbe(PLUS_KEY_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('application/json;v=2'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

test('when two ranges name versions, the one named first wins', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('text/html;v=2, application/json;v=1'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

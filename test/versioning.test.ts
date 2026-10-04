/**
 * The versioning cases: every one is a sentence about which
 * route a request carrying a given `Accept` header should
 * reach. The routes it reaches live in `versioning-fixture.ts`
 * and the probe that serves them in `probe.ts`.
 */
import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from './probe.ts';
import {
  HEADER_PATH,
  HEADER_PROBE,
  MEDIA_PATH,
  MEDIA_TYPE_PROBE,
  PLUS_KEY_PROBE,
  VERSION_HEADER,
} from './versioning-fixture.ts';

/** One request, carrying an `Accept` header and nothing else. */
function accept(value: string): RequestInit {
  return { headers: { accept: value } };
}

/** One request, carrying one named header and nothing else. */
function carrying(header: string, value: string): RequestInit {
  return { headers: { [header]: value } };
}

test('a version in the first parameter of the first range reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('application/json;v=1'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '1' });
  } finally {
    await probe.close();
  }
});

test('a version behind another parameter reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('application/json;q=0.8;v=2'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '2' });
  } finally {
    await probe.close();
  }
});

test('a version in a range behind the first reaches its route', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const response = await request(
      probe,
      MEDIA_PATH,
      accept('text/html, application/json;v=2'),
    );
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

test('a version in a named header reaches its route', async () => {
  const probe = await startProbe(HEADER_PROBE);
  try {
    const response = await request(
      probe,
      HEADER_PATH,
      carrying(VERSION_HEADER, '1'),
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ served: '1' });
  } finally {
    await probe.close();
  }
});

test('a version named in the header is the only one that route answers', async () => {
  const probe = await startProbe(HEADER_PROBE);
  try {
    const response = await request(
      probe,
      HEADER_PATH,
      accept('application/json;v=1'),
    );
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a route that is neutral beside a named version answers either', async () => {
  const probe = await startProbe(MEDIA_TYPE_PROBE);
  try {
    const named = await request(
      probe,
      `${MEDIA_PATH}/list`,
      accept('application/json;v=1'),
    );
    expect(named.status).toBe(HttpStatus.OK);
    expect(named.body).toStrictEqual({
      served: 'neutral-or-1',
    });
    const none = await request(
      probe,
      `${MEDIA_PATH}/list`,
      accept('application/json'),
    );
    expect(none.status).toBe(HttpStatus.OK);
    expect(none.body).toStrictEqual({ served: 'neutral-or-1' });
  } finally {
    await probe.close();
  }
});

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
    // The first range asks for `2` and the second for `1`, so
    // answering `2` is what reading the header in order says,
    // and answering `1` is what picking arbitrarily says.
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

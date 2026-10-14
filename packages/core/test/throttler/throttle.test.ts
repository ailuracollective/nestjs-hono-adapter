import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { ALLOWED, LIMIT, TWO_REQUESTS } from './fixture.ts';
import { exhaust, withProbe } from './support.ts';

test('a request under the limit is answered by the route', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(ALLOWED);
  });
});

test('the guard writes the limit it was given onto the answer', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');

    expect(response.headers.get('x-ratelimit-limit')).toBe(String(LIMIT));
  });
});

test('the guard counts down what is left of the window', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/ping');
    const second = await request(probe, '/ping');

    expect(first.headers.get('x-ratelimit-remaining')).toBe(String(LIMIT - 1));
    expect(second.headers.get('x-ratelimit-remaining')).toBe(String(LIMIT - TWO_REQUESTS));
  });
});

test('the guard says when the window ends', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');
    const reset = response.headers.get('x-ratelimit-reset');

    expect(reset).not.toBeNull();
    expect(Number(reset)).toBeGreaterThan(0);
  });
});

test('the three limit headers travel together', async () => {
  await withProbe(async (probe) => {
    const { headers } = await request(probe, '/ping');

    for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
      expect(headers.get(name)).not.toBeNull();
    }
  });
});

test('a refusal carries the retry window the guard set', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/ping');
    const refused = await request(probe, '/ping');

    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const retryAfter = refused.headers.get('retry-after');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

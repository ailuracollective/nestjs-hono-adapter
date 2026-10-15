import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { HEALTHY, HealthModule, NO_CACHE, UP } from '#compat-test/terminus/fixture';

import { HEALTHY_BODY, withProbe } from '#compat-test/terminus/support';

test('a check carries the key its indicator answered under', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    expect(response.body).toMatchObject({
      info: { [HEALTHY]: { status: UP } },
    });
  });
});

test('the check is answered with the cache the decorator sets', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    expect(response.headers.get('cache-control')).toBe(NO_CACHE);
  });
});

test('a degraded check is answered with the same cache header', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/degraded');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('cache-control')).toBe(NO_CACHE);
  });
});

test('a health check answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: HealthModule,
  });
  try {
    const response = await request(probe, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(HEALTHY_BODY);
  } finally {
    await probe.close();
  }
});

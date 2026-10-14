import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { withProbe } from '#adapter-test/cache-manager/fixture';

test('a route under the interceptor does not move on the second read', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');
    const second = await request(probe, '/counted');

    expect(first.body).toStrictEqual({ calls: 1 });
    expect(second.body).toStrictEqual({ calls: 1 });
  });
});

test('a route without the interceptor moves on every call', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/uncached');
    const second = await request(probe, '/uncached');

    expect(first.body).toStrictEqual({ calls: 1 });
    expect(second.body).toStrictEqual({ calls: 2 });
  });
});

test('the interceptor keeps the first answer', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(first.status).toBe(HttpStatus.OK);
    expect(kept.status).toBe(HttpStatus.OK);
    expect(kept.body).toStrictEqual(first.body);
  });
});

test('the route under the interceptor ran once for two requests', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/counted');
    await request(probe, '/counted');

    const uncached = await request(probe, '/uncached');
    expect(uncached.body).toStrictEqual({ calls: 2 });
  });
});

test('a value put in the cache is read back', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/seed');
    const response = await request(probe, '/cached');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe('stored-value');
  });
});

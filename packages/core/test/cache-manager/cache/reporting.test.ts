import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import {
  CacheModuleFixture,
  resetCalls,
  withProbe,
} from '#adapter-test/cache-manager/fixture';

test('the interceptor says on the answer whether it was a miss', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/counted');

    expect(first.headers.get('x-cache')).toBe('MISS');
  });
});

test('the interceptor says on the answer when it was a hit', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(kept.headers.get('x-cache')).toBe('HIT');
  });
});

test('a route without the interceptor says nothing about the cache', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/uncached');

    expect(response.headers.get('x-cache')).toBeNull();
  });
});

test('two queries of one route are two cache keys', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/seeded?tenant=one');
    const other = await request(probe, '/seeded?tenant=two');

    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(other.headers.get('x-cache')).toBe('MISS');
  });
});

test('a cached route answers over a real connection', async () => {
  resetCalls();
  const probe = await startProbe({
    mode: 'socket',
    module: CacheModuleFixture,
  });
  try {
    const first = await request(probe, '/counted');
    const kept = await request(probe, '/counted');

    expect(first.status).toBe(HttpStatus.OK);
    expect(kept.body).toStrictEqual(first.body);
  } finally {
    await probe.close();
  }
});

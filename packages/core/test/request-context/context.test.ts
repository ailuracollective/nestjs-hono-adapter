import { expect, test } from 'bun:test';

import { request, startProbe } from '#test/probe';

import { ContextModule } from './fixture.ts';
import { seenBy, seenOf, withProbe } from './support.ts';

test('the request Nest injects is the one the route was handed', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    expect(seen.same).toBe(true);
  });
});

test('a request-scoped provider sees the URL of its own request', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    expect(seen.url).toBe('/seen');
  });
});

test('a request-scoped provider is built once for one request', async () => {
  await withProbe(async (probe) => {
    const seen = await seenBy(probe);

    expect(seen.serial).toBe(1);
  });
});

test('two requests do not share one request-scoped provider', async () => {
  await withProbe(async (probe) => {
    const first = await seenBy(probe);
    const second = await seenBy(probe);

    expect(second.serial).toBe(first.serial + 1);
  });
});

test('two requests in flight at once do not share a provider', async () => {
  await withProbe(async (probe) => {
    const answers = await Promise.all([
      seenBy(probe),
      seenBy(probe),
    ]);
    const [first, second] = answers;

    expect(second.serial).not.toBe(first.serial);
  });
});

test('the request context holds over a connection as well', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ContextModule,
  });
  try {
    const response = await request(probe, '/seen');

    expect(seenOf(response.body).same).toBe(true);
  } finally {
    await probe.close();
  }
});

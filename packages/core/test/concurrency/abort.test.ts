import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { ConcurrencyModule } from './fixture.ts';

const unfinished = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(source): void {
      source.enqueue(new TextEncoder().encode('{"a":'));
    },
  });

test('a client that aborts its upload leaves the server answering', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ConcurrencyModule,
  });
  try {
    const controller = new AbortController();
    const pending = request(probe, '/echo', {
      body: unfinished(),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });
    controller.abort();
    const aborted = await pending.then(
      () => false,
      () => true,
    );
    expect(aborted).toBe(true);

    const after = await request(probe, '/who?id=after');
    expect(after.status).toBe(HttpStatus.OK);
  } finally {
    await probe.close();
  }
});

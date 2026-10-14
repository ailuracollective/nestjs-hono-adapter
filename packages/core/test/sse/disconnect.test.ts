import { expect, test } from 'bun:test';

import { firstValueFrom, timeout } from 'rxjs';

import { SseModule, startProbe, torn } from '#adapter-test/support/index';
import { FRAME_TIMEOUT, bodyOf, openStream, respondOverBareSocket, streamText } from './support.ts';

test('a client that walks away unsubscribes the handler', async () => {
  const probe = await startProbe({ module: SseModule });
  const client = await openStream(probe, '/sse/open');
  try {
    client.abort();
    await firstValueFrom(torn.pipe(timeout(FRAME_TIMEOUT)));
    const text = await streamText(probe, '/sse/frames');
    expect(text).toContain('data: {"count":1}');
  } finally {
    await probe.close();
  }
});

test('a request that ends unsubscribes the handler', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: SseModule,
  });
  try {
    const { incoming } = await respondOverBareSocket(probe, '/sse/open');
    const gone = firstValueFrom(torn.pipe(timeout(FRAME_TIMEOUT)));
    incoming.emit('close');
    await gone;
  } finally {
    await probe.close();
  }
});

test('a reader that lets go unsubscribes the handler', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: SseModule,
  });
  try {
    const { response } = await respondOverBareSocket(probe, '/sse/open');
    const gone = firstValueFrom(torn.pipe(timeout(FRAME_TIMEOUT)));
    await bodyOf(response).cancel();
    await gone;
  } finally {
    await probe.close();
  }
});

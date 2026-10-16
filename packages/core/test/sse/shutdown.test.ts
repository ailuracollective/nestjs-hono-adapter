import { test } from 'bun:test';

import { SseModule, startProbe } from '#adapter-test/support/index';
import { FRAME_TIMEOUT, failAfter, openStream } from './support.ts';

test('closing the application while a stream is open settles', async () => {
  const probe = await startProbe({
    application: { forceCloseConnections: true },
    module: SseModule,
  });
  const client = await openStream(probe, '/sse/open');
  try {
    await Promise.race([probe.close(), failAfter(FRAME_TIMEOUT)]);
  } finally {
    client.abort();
  }
  await probe.close();
});

import { expect, test } from 'bun:test';

import { TOTAL } from './fixture.ts';
import { clientFor, closeAll, expectPing, freePort, startHybrid, sum } from './support.ts';

test('a TCP microservice answers while HTTP still serves', async () => {
  const port = await freePort();
  const probe = await startHybrid(port);
  const client = clientFor(port);
  try {
    await probe.app.startAllMicroservices();
    await client.connect();
    expect(await sum(client)).toBe(TOTAL);
    await expectPing(probe);
  } finally {
    await closeAll(probe, client);
  }
});

test('a microservice that served nothing closes cleanly', async () => {
  const port = await freePort();
  const probe = await startHybrid(port);
  await probe.app.startAllMicroservices();
  await probe.close();
  await probe.close();
});

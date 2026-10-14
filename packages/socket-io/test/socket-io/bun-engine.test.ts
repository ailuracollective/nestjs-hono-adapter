import { expect, test } from 'bun:test';

import { bunServer } from '#adapter/servers/bun';

import { ADMIN, PING, SHOUT, SHOUTED } from './gateways.ts';
import { open, received, start } from './support.ts';

test('a gateway answers the acknowledgement of a frame', async () => {
  const started = await start(bunServer());
  const client = await open(started.url);
  expect(
    await client.emitWithAck(PING, { count: 1 }),
  ).toStrictEqual({ echo: { count: 1 } });
  client.close();
  await started.close();
});

test('a handler answers on an event of its own', async () => {
  const started = await start(bunServer());
  const client = await open(started.url);
  const answer = received<string>(client, SHOUTED);
  client.emit(SHOUT, 'hey');
  expect(await answer).toBe('hey');
  client.close();
  await started.close();
});

test('a namespaced gateway answers on its namespace', async () => {
  const started = await start(bunServer());
  const client = await open(started.url, ADMIN);
  expect(await client.emitWithAck('who', 'me')).toBe('admin');
  client.close();
  await started.close();
});

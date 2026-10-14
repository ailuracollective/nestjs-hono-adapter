import { expect, test } from 'bun:test';

import { gone } from './gateways.ts';
import { open, quiet, start } from './support.ts';

test('a disconnect reaches the gateway', async () => {
  const started = await start();
  const client = await open(started.url);
  const { id } = client;
  if (id === undefined) {
    throw new TypeError('the client connected with no id');
  }
  client.close();
  await quiet();
  expect(gone).toContain(id);
  await started.close();
});

test('closing the application settles', async () => {
  const started = await start();
  const client = await open(started.url);
  client.close();
  await started.close();
  expect(true).toBe(true);
});

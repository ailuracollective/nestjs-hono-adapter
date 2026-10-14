import { expect, test } from 'bun:test';

import { app, registerApplication } from './support.ts';

registerApplication();

test('answers through the adapter itself, not only the proxy', async () => {
  const application = await app();
  const answer = await application
    .getHttpAdapter()
    .inject({ url: '/ping' });
  const body: unknown = answer.json();
  expect(body).toEqual({ pong: true });
});

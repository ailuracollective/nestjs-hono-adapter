import { expect, test } from 'bun:test';
import { upgradeWebSocket } from 'hono/cloudflare-workers';

import { webSocketFromHost } from '#adapter/servers/fetch';
import type { FetchHostWebSocket } from '#adapter/servers/fetch';

test('a host helper is taken as it comes, with no cast', () => {
  // oxlint-disable-next-line typescript/no-deprecated -- `hono/cloudflare-workers` re-exports it; the maintained `@hono/cloudflare-workers` publishes the same signature.
  const host: FetchHostWebSocket = upgradeWebSocket;
  expect(typeof webSocketFromHost(host)).toBe('function');
});

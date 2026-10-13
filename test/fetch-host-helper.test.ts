import { expect, test } from 'bun:test';
import { upgradeWebSocket } from 'hono/cloudflare-workers';

import { webSocketFromHost } from '../packages/core/src/servers/fetch.ts';
import type { FetchHostWebSocket } from '../packages/core/src/servers/fetch.ts';

/**
 * The host's own helper goes in as it comes from the package,
 * with no cast. `WebSocketEvents` and Hono's `WSEvents` differ
 * in how they spell an optional handler, so this pins the two
 * together: an assignment that stops compiling is the shape
 * drifting apart.
 */
test('a host helper is taken as it comes, with no cast', () => {
  // oxlint-disable-next-line typescript/no-deprecated -- `hono/cloudflare-workers` re-exports it; the maintained `@hono/cloudflare-workers` publishes the same signature.
  const host: FetchHostWebSocket = upgradeWebSocket;
  expect(typeof webSocketFromHost(host)).toBe('function');
});

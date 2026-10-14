import { expect, test } from 'bun:test';

import { fetchServer, webSocketFromHost } from '#adapter/servers/fetch';
import type { FetchHostWebSocket } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';
import type { WebSocketSupport } from '#adapter/core/ports/transport';

const idleHelper: FetchHostWebSocket = () => () => Promise.resolve();

const supportOf = (adapter: ServerAdapter): WebSocketSupport => {
  const transport = adapter.getTransport();
  const factory = transport.createWebSocket;
  if (factory === undefined) throw new TypeError('the transport carried no websocket helper');
  return factory(adapter.getHono());
};

test('a host helper becomes the option, with nothing to install', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer({
      upgradeWebSocket: webSocketFromHost(idleHelper),
    }),
  });
  const support = supportOf(adapter);
  expect(support.upgradeWebSocket).toBe(idleHelper);
  const release = support.install(adapter.getHttpServer());
  expect(typeof release).toBe('function');
  release();
});

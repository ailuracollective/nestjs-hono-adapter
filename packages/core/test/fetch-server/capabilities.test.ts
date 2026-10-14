import { expect, test } from 'bun:test';

import { fetchServer } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';

test('a capability the fetch transport does not port is refused', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const transport = adapter.getTransport();
  expect(() => {
    transport.serveStatic({
      index: 'index.html',
      root: './public',
    });
  }).toThrow(TypeError);
  const upgrade = transport.createWebSocket;
  if (upgrade === undefined) {
    throw new TypeError(
      'the fetch transport carries no websocket helper',
    );
  }
  expect(() => {
    upgrade(adapter.getHono());
  }).toThrow(TypeError);
});

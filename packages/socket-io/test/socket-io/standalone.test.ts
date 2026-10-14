import { once } from 'node:events';
import { createServer } from 'node:http';

import { expect, test } from 'bun:test';

import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server } from 'socket.io';

import { ANY_PORT, LOCALHOST, open, within } from './support.ts';

const listeningServer = async (): Promise<ReturnType<typeof createServer>> => {
  const listener = createServer();
  listener.listen(ANY_PORT, LOCALHOST);
  await within(once(listener, 'listening'), 'HTTP listener');
  return listener;
};

const gatewayPort = async (): Promise<number> => {
  const listener = await listeningServer();
  const address = listener.address();
  const closed = once(listener, 'close');
  listener.close();
  await within(closed, 'port release');
  if (address === null || typeof address === 'string')
    throw new TypeError('the port reservation answered with no port');
  return address.port;
};

const portOf = (listener: ReturnType<typeof createServer>): number => {
  const address = listener.address();
  if (address === null || typeof address === 'string')
    throw new TypeError('the listener answered with no port');
  return address.port;
};

test('a gateway on a port of its own owns its listener', async () => {
  const port = await gatewayPort();
  const adapter = new IoAdapter();
  const io = adapter.createIOServer(port);
  try {
    await within(once(io.httpServer, 'listening'), 'gateway listener');
    await within(adapter.close(io), 'gateway shutdown');
    expect(io.httpServer.listening).toBe(false);
  } finally {
    await io.close();
  }
});

const shutdown = async (
  adapter: IoAdapter,
  io: Server,
  listener: ReturnType<typeof createServer>,
): Promise<void> => {
  await within(adapter.close(io), 'gateway shutdown');
  if (!listener.listening) return;
  const closed = once(listener, 'close');
  listener.close();
  await within(closed, 'listener shutdown');
};

test('a gateway attached to a listener answers on it', async () => {
  const listener = await listeningServer();
  const adapter = new IoAdapter(listener);
  const io = adapter.createIOServer(ANY_PORT);
  const client = await open(`http://${LOCALHOST}:${portOf(listener)}`);
  try {
    expect(client.connected).toBe(true);
  } finally {
    client.close();
    await shutdown(adapter, io, listener);
  }
});

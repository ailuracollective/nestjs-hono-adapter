import { once } from 'node:events';
import { createServer } from 'node:http';

import { expect, test } from 'bun:test';

import type { Server } from 'socket.io';

import { HonoIoAdapter } from '#socket-io/index';
import { ADMIN } from './gateways.ts';
import { ANY_PORT, LOCALHOST, open, received, within } from './support.ts';

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

const shutdownGateway = (adapter: HonoIoAdapter, io: Server, namespace: string): Promise<void> => {
  if (namespace === '') return within(adapter.close(io), 'gateway shutdown');
  return within(adapter.close(io.of(namespace)), 'namespace shutdown');
};

const disconnectGateway = async (
  adapter: HonoIoAdapter,
  io: Server,
  options: {
    readonly namespace: string;
    readonly port: number;
  },
): Promise<void> => {
  const { namespace, port } = options;
  io.of(namespace);
  const client = await open(`http://${LOCALHOST}:${port}`, namespace);
  try {
    const disconnected = received(client, 'disconnect');
    await shutdownGateway(adapter, io, namespace);
    await disconnected;
  } finally {
    client.close();
  }
};

const portOf = (listener: ReturnType<typeof createServer>): number => {
  const address = listener.address();
  if (address === null || typeof address === 'string')
    throw new TypeError('the listener answered with no port');
  return address.port;
};

test.each(['', ADMIN])(
  'closing a standalone gateway releases its listener (namespace: %s)',
  async (namespace) => {
    const port = await gatewayPort();
    const adapter = new HonoIoAdapter();
    const io = adapter.createIOServer(port);
    try {
      await within(once(io.httpServer, 'listening'), 'gateway listener');
      await disconnectGateway(adapter, io, { namespace, port });
      expect(io.httpServer.listening).toBe(false);
    } finally {
      await io.close();
    }
  },
);

test('closing an attached gateway leaves the shared listener open', async () => {
  const listener = await listeningServer();
  try {
    const adapter = new HonoIoAdapter(listener);
    const io = adapter.createIOServer(ANY_PORT);
    await within(adapter.close(io.of(ADMIN)), 'attached gateway shutdown');
    expect(listener.listening).toBe(true);
  } finally {
    const closed = once(listener, 'close');
    listener.close();
    await within(closed, 'shared listener shutdown');
  }
});

test('closing an attached gateway disconnects its clients', async () => {
  const listener = await listeningServer();
  try {
    const adapter = new HonoIoAdapter(listener);
    const io = adapter.createIOServer(ANY_PORT);
    await disconnectGateway(adapter, io, {
      namespace: '',
      port: portOf(listener),
    });
    expect(listener.listening).toBe(true);
  } finally {
    const closed = once(listener, 'close');
    listener.close();
    await within(closed, 'shared listener shutdown');
  }
});

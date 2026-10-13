import { expect, spyOn, test } from 'bun:test';
import { Logger } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import { WSContext } from 'hono/ws';

import { ServerAdapter } from '../../../src/index.ts';
import type { NestEnv } from '../../../src/index.ts';
import type {
  WebSocketEvents,
  WebSocketSupport,
} from '../../../src/core/transport.ts';
import { nodeServer } from '../../../src/servers/node.ts';
import { HonoWsAdapter } from '../src/index.ts';
import type { HonoSocket } from '../src/client.ts';

/** The callbacks and clients captured by a transport probe. */
interface Connections {
  events: WebSocketEvents[];
  clients: HonoSocket[];
  adapter: HonoWsAdapter;
}

/**
 * Captures the actual transport callbacks without opening a
 * socket.
 */
async function connections(): Promise<Connections> {
  const events: WebSocketEvents[] = [];
  const clients: HonoSocket[] = [];
  const base = nodeServer();
  const http = new ServerAdapter({
    transport: {
      createServer: base.createServer,
      createWebSocket: (): WebSocketSupport => ({
        install: () => (): void => undefined,
        upgradeWebSocket:
          (factory): MiddlewareHandler<NestEnv> =>
          (context): Promise<Response> => {
            events.push(factory(context));
            return Promise.resolve(context.text('captured'));
          },
      }),
      serveStatic: base.serveStatic,
    },
  });
  const adapter = new HonoWsAdapter(http);
  adapter.create(0).on('connection', (client: HonoSocket) => {
    clients.push(client);
  });
  await http.getHono().request('/');
  await http.getHono().request('/');
  return { adapter, clients, events };
}

/** Binds each connection using the transport's open callback. */
function openConnections(probe: Connections): void {
  const socket = new WSContext({
    close: (): void => undefined,
    readyState: 1,
    send: (): void => undefined,
  });
  for (const events of probe.events) {
    if (events.onOpen === undefined) {
      throw new Error('Missing open callback');
    }
    events.onOpen({}, socket);
  }
}

/** Observes the connection-local error channel. */
function collectErrors(client: HonoSocket): unknown[] {
  const seen: unknown[] = [];
  client.on('error', (error: unknown) => {
    seen.push(error);
  });
  return seen;
}

/** Requires the callback the adapter must hand its transport. */
function errorCallback(
  events: WebSocketEvents | undefined,
): (error: unknown) => void {
  if (events === undefined) {
    throw new Error('Missing connection');
  }
  if (events.onError === undefined) {
    throw new Error('Missing error callback');
  }
  return events.onError;
}

/**
 * Errors before binding must not fabricate a gateway
 * connection.
 */
function exerciseErrors(
  probe: Connections,
  failure: Error,
): void {
  const onError = errorCallback(probe.events[0]);
  onError(failure);
  expect(probe.clients).toHaveLength(0);
  openConnections(probe);
  const seen = probe.clients.map(collectErrors);
  onError(failure);
  expect(seen).toStrictEqual([[failure], []]);
}

test('transport errors reach only their client and are safe before binding', async () => {
  const probe = await connections();
  const logged = spyOn(
    Logger.prototype,
    'error',
  ).mockImplementation((): void => undefined);
  const failure = new Error('transport failure');
  try {
    exerciseErrors(probe, failure);
    expect(logged.mock.calls).toStrictEqual([
      [failure],
      [failure],
    ]);
  } finally {
    logged.mockRestore();
    await probe.adapter.dispose();
  }
});

import { expect, spyOn, test } from 'bun:test';
import { Logger } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import { WSContext } from 'hono/ws';

import { ServerAdapter } from '#adapter/index';
import type { NestEnv } from '#adapter/index';
import type { WebSocketEvents, WebSocketSupport } from '#adapter/core/ports/transport';
import { nodeServer } from '#adapter/servers/node';
import { HonoWsAdapter } from '#ws/index';
import type { HonoSocket } from '#ws/client/index';

interface Connections {
  events: WebSocketEvents[];
  clients: HonoSocket[];
  adapter: HonoWsAdapter;
}

const connections = async (): Promise<Connections> => {
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
};

const openConnections = (probe: Connections): void => {
  const socket = new WSContext({
    close: (): void => undefined,
    readyState: 1,
    send: (): void => undefined,
  });
  for (const events of probe.events) {
    if (events.onOpen === undefined) throw new Error('Missing open callback');
    events.onOpen({}, socket);
  }
};

const collectErrors = (client: HonoSocket): unknown[] => {
  const seen: unknown[] = [];
  client.on('error', (error: unknown) => {
    seen.push(error);
  });
  return seen;
};

const errorCallback = (events: WebSocketEvents | undefined): ((error: unknown) => void) => {
  if (events === undefined) throw new Error('Missing connection');
  if (events.onError === undefined) throw new Error('Missing error callback');
  return events.onError;
};

const exerciseErrors = (probe: Connections, failure: Error): void => {
  const onError = errorCallback(probe.events[0]);
  onError(failure);
  expect(probe.clients).toHaveLength(0);
  openConnections(probe);
  const seen = probe.clients.map(collectErrors);
  onError(failure);
  expect(seen).toStrictEqual([[failure], []]);
};

test('transport errors reach only their client and are safe before binding', async () => {
  const probe = await connections();
  const logged = spyOn(Logger.prototype, 'error').mockImplementation((): void => undefined);
  const failure = new Error('transport failure');
  try {
    exerciseErrors(probe, failure);
    expect(logged.mock.calls).toStrictEqual([[failure], [failure]]);
  } finally {
    logged.mockRestore();
    await probe.adapter.dispose();
  }
});

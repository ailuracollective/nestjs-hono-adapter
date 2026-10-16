import { expect, spyOn, test } from 'bun:test';

import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import type { MiddlewareHandler } from 'hono';
import { WSContext } from 'hono/ws';

import { ServerAdapter } from '#adapter/index';
import type { NestEnv, Transport, WebSocketEvents, WebSocketSupport } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { restoreWebClasses } from '#test/probe/in-process';

const ANY_PORT = 0;

const CAPTURED = 'captured';

const OPEN_STATE = 1;

const ROOT_PATH = '/';

interface Client {
  on: (name: string, listener: (payload: unknown) => void) => unknown;
}

interface Server {
  on: (name: string, listener: (client: Client) => void) => unknown;
}

interface Seen {
  readonly clients: Client[];
  readonly events: WebSocketEvents[];
}

interface Connections extends Seen {
  readonly close: () => Promise<void>;
}

const isServer = (value: unknown): value is Server =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'on') === 'function';

@Module({})
class EmptyModule {}

/** A helper that upgrades nothing: it hands the connection events to the case and answers 200. */
const capturingTransport = (events: WebSocketEvents[]): Transport => {
  const base = nodeServer();
  return {
    createServer: base.createServer,
    createWebSocket: (): WebSocketSupport => ({
      install: () => (): void => undefined,
      upgradeWebSocket:
        (factory): MiddlewareHandler<NestEnv> =>
        (context): Promise<Response> => {
          events.push(factory(context));
          return Promise.resolve(context.text(CAPTURED));
        },
    }),
    serveStatic: base.serveStatic,
  };
};

const connections = async (): Promise<Connections> => {
  const seen: Seen = { clients: [], events: [] };
  const adapter = new ServerAdapter({ transport: capturingTransport(seen.events) });
  const app = await NestFactory.create(EmptyModule, adapter, { logger: false });
  await app.init();
  const ws = new WsAdapter(app);
  const created: unknown = ws.create(ANY_PORT);
  if (!isServer(created)) throw new TypeError('the adapter built no server');
  created.on('connection', (client: Client) => {
    seen.clients.push(client);
  });
  await Promise.all([adapter.getHono().request(ROOT_PATH), adapter.getHono().request(ROOT_PATH)]);
  return {
    clients: seen.clients,
    close: async () => {
      await app.close();
      restoreWebClasses();
    },
    events: seen.events,
  };
};

const openConnections = (seen: Seen): void => {
  const socket = new WSContext({
    close: (): void => undefined,
    readyState: OPEN_STATE,
    send: (): void => undefined,
  });
  for (const events of seen.events) {
    if (events.onOpen === undefined) throw new Error('Missing open callback');
    events.onOpen({}, socket);
  }
};

const collectErrors = (client: Client): unknown[] => {
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
    await probe.close();
  }
});

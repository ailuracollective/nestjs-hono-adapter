import { expect, test } from 'bun:test';
import type { Server as HttpServer } from 'node:http';

import { createNodeWebSocket } from '@hono/node-ws';
import type { WSEvents } from 'hono/ws';
import type { WebSocket as ServerSocket } from 'ws';

import { ServerAdapter } from '#adapter/index';
import type { Transport } from '#adapter/core/ports/transport';
import { nodeServer } from '#adapter/servers/node';
import { FACTOR, GATEWAY_PATH, INPUT, PING } from './gateways.ts';
import {
  QUIET_MS,
  ask,
  collect,
  expectAnswered,
  open,
  quiet,
  socketUrl,
  startGateways,
} from './support.ts';

const noDisposer = (): void => undefined;

const withoutOnOpen = (): Transport => {
  const base = nodeServer();
  return {
    createServer: base.createServer,
    createWebSocket: (app) => {
      const node = createNodeWebSocket({ app });
      return {
        install: (server): (() => void) => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the helper only reads a handle off it.
          node.injectWebSocket(server as unknown as HttpServer);
          return noDisposer;
        },
        upgradeWebSocket: (factory) =>
          node.upgradeWebSocket((context) => {
            const events = factory(context);
            const kept: WSEvents<ServerSocket> = {};
            if (events.onClose) kept.onClose = events.onClose;
            if (events.onError) kept.onError = events.onError;
            if (events.onMessage) kept.onMessage = events.onMessage;
            return kept;
          }),
      };
    },
    serveStatic: base.serveStatic,
  };
};

const expectOneReplyEach = async (frames: () => unknown[], sent: number[]): Promise<void> => {
  await quiet(QUIET_MS);
  expect(frames()).toStrictEqual(
    sent.map((amount) => ({
      data: { doubled: amount * FACTOR },
      event: PING,
    })),
  );
};

test('a gateway answers on a helper that has no onOpen', async () => {
  const probe = await startGateways(
    new ServerAdapter({
      transport: withoutOnOpen(),
    }),
  );
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(socket, { amount: INPUT });
  } finally {
    socket.close();
    await probe.close();
  }
});

test('a socket on a helper with no onOpen answers every frame once', async () => {
  const probe = await startGateways(
    new ServerAdapter({
      transport: withoutOnOpen(),
    }),
  );
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    const frames = collect(socket);
    await expectAnswered(socket, { amount: INPUT });
    const second = await ask(socket, { amount: INPUT + 1 });
    expect(second).toStrictEqual({
      data: { doubled: (INPUT + 1) * FACTOR },
      event: PING,
    });
    await expectOneReplyEach(frames, [INPUT, INPUT + 1]);
  } finally {
    socket.close();
    await probe.close();
  }
});

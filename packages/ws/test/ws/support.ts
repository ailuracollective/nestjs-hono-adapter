import { expect } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { firstValueFrom, from, fromEvent, throwError, timeout } from 'rxjs';

import { bunAdapter } from '#test/bun-adapter';
import { restoreWebClasses } from '#test/probe/in-process';
import type { NestHonoApplication, ServerAdapter } from '#adapter/index';
import { ANSWER, GatewayModule } from './gateways.ts';

const TIMEOUT_MS = 5000;

const QUIET_MS = 150;

const LOCALHOST = '127.0.0.1';

const ANY_PORT = 0;

interface WsFrame {
  readonly data: unknown;
  readonly event: string;
}

interface WsOptions {
  readonly messageParser?: (data: unknown) => WsFrame | undefined;
}

interface WsProbe {
  readonly app: INestApplication;
  readonly ws: WsAdapter;
  readonly origin: string;
  close: () => Promise<void>;
}

const quiet = async (ms: number): Promise<void> => {
  await Bun.sleep(ms);
};

const socketUrl = (probe: WsProbe, path: string): string => `ws://${probe.origin}${path}`;

const within = <Result>(work: Promise<Result>, label: string): Promise<Result> =>
  firstValueFrom(
    from(work).pipe(
      timeout({
        first: TIMEOUT_MS,
        with: () => throwError(() => new Error(`${label} timed out`)),
      }),
    ),
  );

const startGateways = async (
  adapter: ServerAdapter = bunAdapter(),
  options?: WsOptions,
): Promise<WsProbe> => {
  const app = await NestFactory.create<NestHonoApplication>(GatewayModule, adapter, {
    logger: false,
  });
  const ws = new WsAdapter(app, options);
  app.useWebSocketAdapter(ws);
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string')
    throw new TypeError('the adapter is not listening on a port');
  return {
    app,
    // A Bun server installs its own lightweight web classes; the probe puts the process ones back.
    close: async () => {
      await app.close();
      restoreWebClasses();
    },
    origin: `${LOCALHOST}:${address.port}`,
    ws,
  };
};

const open = async (url: string): Promise<WebSocket> => {
  const socket = new WebSocket(url);
  const opened = firstValueFrom(fromEvent<Event>(socket, 'open'));
  await within(opened, 'the upgrade');
  return socket;
};

const nextMessage = async (socket: WebSocket): Promise<unknown> => {
  const event = await within(
    firstValueFrom(fromEvent<MessageEvent>(socket, 'message')),
    'the answer',
  );
  return JSON.parse(String(event.data)) as unknown;
};

const ask = (socket: WebSocket, data: unknown): Promise<unknown> => {
  const pending = nextMessage(socket);
  socket.send(JSON.stringify({ data, event: 'ping' }));
  return pending;
};

const collect = (socket: WebSocket): (() => unknown[]) => {
  const frames: unknown[] = [];
  socket.addEventListener('message', (event) => {
    frames.push(JSON.parse(String(event.data)) as unknown);
  });
  return () => frames;
};

const expectAnswered = async (socket: WebSocket, data: unknown): Promise<void> => {
  const answer = await ask(socket, data);
  expect(answer).toStrictEqual(ANSWER);
};

export {
  ANY_PORT,
  QUIET_MS,
  ask,
  collect,
  expectAnswered,
  nextMessage,
  open,
  quiet,
  socketUrl,
  startGateways,
};
export type { WsFrame, WsOptions, WsProbe };

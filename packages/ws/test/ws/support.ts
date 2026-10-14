import { expect } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  firstValueFrom,
  from,
  fromEvent,
  throwError,
  timeout,
} from 'rxjs';

import { bunAdapter } from '#test/bun-adapter';
import type {
  NestHonoApplication,
  ServerAdapter,
} from '#adapter/index';
import type { MessageParser } from '#ws/client/index';
import { HonoWsAdapter } from '#ws/index';
import { ANSWER, GatewayModule, PING } from './gateways.ts';

/** How long a socket is given before a case fails. */
const TIMEOUT_MS = 5000;

/** How long a case waits before it decides a socket is quiet. */
const QUIET_MS = 150;

/** The interface every case binds to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** Waits for the given number of milliseconds. */
const quiet = async (ms: number): Promise<void> => {
  await Bun.sleep(ms);
};

/** A running application and the interface it serves. */
interface WsProbe {
  /** The Nest application. */
  readonly app: INestApplication;
  /** The WebSocket adapter bound to it. */
  readonly ws: HonoWsAdapter;
  /** The address the gateways answer on. */
  readonly origin: string;
  /** Closes the application. */
  close: () => Promise<void>;
}

/** The address one gateway path is reached at. */
const socketUrl = (probe: WsProbe, path: string): string =>
  `ws://${probe.origin}${path}`;

/** Fails a case that waits longer than a socket is given. */
const within = <Result>(
  work: Promise<Result>,
  label: string,
): Promise<Result> =>
  firstValueFrom(
    from(work).pipe(
      timeout({
        first: TIMEOUT_MS,
        with: () =>
          throwError(() => new Error(`${label} timed out`)),
      }),
    ),
  );

/** Starts the gateway fixture on an ephemeral port. */
const startGateways = async (
  adapter: ServerAdapter = bunAdapter(),
  options?: { readonly messageParser?: MessageParser },
): Promise<WsProbe> => {
  const app = await NestFactory.create<NestHonoApplication>(
    GatewayModule,
    adapter,
    {
      logger: false,
    },
  );
  const ws = new HonoWsAdapter(app, options);
  app.useWebSocketAdapter(ws);
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return {
    app,
    close: () => app.close(),
    origin: `${LOCALHOST}:${address.port}`,
    ws,
  };
};

/** Opens one socket and waits for the upgrade to complete. */
const open = async (url: string): Promise<WebSocket> => {
  const socket = new WebSocket(url);
  const opened = firstValueFrom(
    fromEvent<Event>(socket, 'open'),
  );
  await within(opened, 'the upgrade');
  return socket;
};

/** The next frame the socket is sent, parsed. */
const nextMessage = async (
  socket: WebSocket,
): Promise<unknown> => {
  const event = await within(
    firstValueFrom(fromEvent<MessageEvent>(socket, 'message')),
    'the answer',
  );
  return JSON.parse(String(event.data)) as unknown;
};

/** Sends one event and answers what the gateway sent back. */
const ask = (
  socket: WebSocket,
  data: unknown,
  correlation?: string | number,
): Promise<unknown> => {
  const pending = nextMessage(socket);
  const request = { data, event: PING, id: correlation };
  socket.send(JSON.stringify(request));
  return pending;
};

/** Every frame the socket is sent from now on. */
const collect = (socket: WebSocket): (() => unknown[]) => {
  const frames: unknown[] = [];
  socket.addEventListener('message', (event) => {
    frames.push(JSON.parse(String(event.data)) as unknown);
  });
  return () => frames;
};

/** Asks one socket and says it answered as the fixture does. */
const expectAnswered = async (
  socket: WebSocket,
  data: unknown,
): Promise<void> => {
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

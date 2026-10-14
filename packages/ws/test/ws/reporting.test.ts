import { expect, test } from 'bun:test';

import { BaseWsExceptionFilter } from '@nestjs/websockets';

import { bunAdapter } from '#test/bun-adapter';
import { HonoSocket } from '#ws/client/index';
import { HonoWsAdapter } from '#ws/index';
import { GatewayServer } from '#ws/server';
import { FAIL, GATEWAY_PATH } from './gateways.ts';
import {
  ANY_PORT,
  QUIET_MS,
  nextMessage,
  open,
  quiet,
  socketUrl,
  startGateways,
} from './support.ts';

/** Whether the installed Nest answers a thrown handler. */
const nestAnswersExceptions = (): boolean => {
  const candidate: unknown = Reflect.get(
    BaseWsExceptionFilter.prototype,
    'isNativeWebSocket',
  );
  return typeof candidate === 'function';
};

/** What a window that saw no answer resolves to. */
const NOTHING = Symbol('nothing');

/** Sends one event and answers what came, or nothing. */
const sendOrNothing = async (
  socket: WebSocket,
  event: string,
): Promise<unknown> => {
  socket.send(JSON.stringify({ event }));
  const outcome = await Promise.race([
    nextMessage(socket),
    quiet(QUIET_MS).then(() => NOTHING),
  ]);
  if (outcome === NOTHING) {
    return NOTHING;
  }
  return outcome;
};

test('a handler that throws is answered the way Nest answers it', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    const answer = await sendOrNothing(socket, FAIL);
    if (nestAnswersExceptions()) {
      expect(answer).toMatchObject({ event: 'exception' });
      return;
    }
    expect(answer).toBe(NOTHING);
  } finally {
    socket.close();
    await probe.close();
  }
});

test('a failure on a path or its socket is reported, not thrown', () => {
  const adapter = new HonoWsAdapter(bunAdapter());
  const server = adapter.bindErrorHandler(new GatewayServer());
  const socket = new HonoSocket();
  server.emit('connection', socket);
  expect(() => {
    server.emit('error', new Error('the path failed'));
  }).not.toThrow();
  expect(() => {
    socket.emit('error', new Error('the socket failed'));
  }).not.toThrow();
});

test('a gateway option the adapter cannot serve is refused', () => {
  const adapter = new HonoWsAdapter(bunAdapter());

  expect(() => {
    adapter.create(ANY_PORT, { namespace: '/chat' });
  }).toThrow(TypeError);
  expect(() => {
    adapter.create(ANY_PORT, { perMessageDeflate: true });
  }).toThrow(TypeError);
  expect(() => {
    adapter.create(ANY_PORT, { server: new GatewayServer() });
  }).toThrow(TypeError);
});

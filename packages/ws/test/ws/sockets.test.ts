import { expect, test } from 'bun:test';

import { GATEWAY_PATH, SOCKET, isRecord } from './gateways.ts';
import {
  nextMessage,
  open,
  socketUrl,
  startGateways,
} from './support.ts';

/** Reads what the socket a handler was given can do. */
const shapeFrom = (
  answer: unknown,
): Record<string, unknown> => {
  if (!isRecord(answer)) {
    throw new TypeError(
      `the answer was not a frame: ${JSON.stringify(answer)}`,
    );
  }
  const { data } = answer;
  if (!isRecord(data)) {
    throw new TypeError(
      `the frame carried no shape: ${JSON.stringify(data)}`,
    );
  }
  return {
    close: data.close,
    on: data.on,
    once: data.once,
    readyState: data.readyState,
    send: data.send,
  };
};

/** Sends one event of the fixture's own and answers what came. */
const sendEvent = (
  socket: WebSocket,
  event: string,
): Promise<unknown> => {
  const pending = nextMessage(socket);
  socket.send(JSON.stringify({ event }));
  return pending;
};

test('closing without a client ever connecting is not an error', async () => {
  const probe = await startGateways();
  await probe.close();
  await probe.close();
});

test('a handler is handed a socket that can send and says its state', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    expect(
      shapeFrom(await sendEvent(socket, SOCKET)),
    ).toStrictEqual({
      close: 'function',
      on: 'function',
      once: 'function',
      readyState: 1,
      send: 'function',
    });
  } finally {
    socket.close();
    await probe.close();
  }
});

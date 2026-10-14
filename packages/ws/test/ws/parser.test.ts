import { expect, spyOn, test } from 'bun:test';

import { Logger } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import type { WsFrame } from '#ws/client/index';
import {
  ANSWER,
  GATEWAY_PATH,
  INPUT,
  PING,
} from './gateways.ts';
import {
  QUIET_MS,
  collect,
  nextMessage,
  open,
  quiet,
  socketUrl,
  startGateways,
} from './support.ts';

/** The fixture's own dialect, `<event>:<amount>`. */
const colonParser = (raw: unknown): WsFrame | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const [event = '', amount = '0'] = raw.split(':');
  return { data: { amount: Number(amount) }, event };
};

/** Watches the adapter's logger. */
const watchLogger = (): {
  readonly restore: () => void;
  readonly seen: unknown[];
} => {
  const seen: unknown[] = [];
  const spy = spyOn(
    Logger.prototype,
    'error',
  ).mockImplementation((message: unknown) => {
    seen.push(message);
  });
  return {
    restore: () => {
      spy.mockRestore();
    },
    seen,
  };
};

/** Opens a gateway whose parser throws. */
const parseFailureProbe = async (
  failure: Error,
): Promise<{
  readonly frames: unknown[];
  readonly open: boolean;
  readonly reported: unknown[];
}> => {
  const watched = watchLogger();
  const probe = await startGateways(bunAdapter(), {
    messageParser: () => {
      throw failure;
    },
  });
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  const frames = collect(socket);
  socket.send(JSON.stringify({ amount: INPUT, event: PING }));
  await quiet(QUIET_MS);
  const stayedOpen = socket.readyState === WebSocket.OPEN;
  await probe.close();
  watched.restore();
  return {
    frames: frames(),
    open: stayedOpen,
    reported: watched.seen,
  };
};

test('a parser given to the adapter reads its own frames', async () => {
  const probe = await startGateways(bunAdapter(), {
    messageParser: colonParser,
  });
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    const pending = nextMessage(socket);
    socket.send(`${PING}:${INPUT}`);
    expect(await pending).toStrictEqual(ANSWER);
  } finally {
    socket.close();
    await probe.close();
  }
});

test('setMessageParser() replaces the reader in place', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    probe.ws.setMessageParser(colonParser);
    const pending = nextMessage(socket);
    socket.send(`${PING}:${INPUT}`);
    expect(await pending).toStrictEqual(ANSWER);
  } finally {
    socket.close();
    await probe.close();
  }
});

test('a parser that throws drops the frame and is reported', async () => {
  const failure = new Error(
    'a parser the application replaced',
  );
  const outcome = await parseFailureProbe(failure);
  expect(outcome.frames).toStrictEqual([]);
  expect(outcome.open).toBe(true);
  expect(outcome.reported).toContain(failure);
});

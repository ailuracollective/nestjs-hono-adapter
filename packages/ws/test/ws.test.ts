import { expect, test } from 'bun:test';

import { bunAdapter } from '../../../test/bun-adapter.ts';
import { ServerAdapter } from '../../../src/index.ts';
import { nodeServer } from '../../../src/servers/node.ts';
import { HonoWsAdapter } from '../src/index.ts';
import { HonoSocket } from '../src/client.ts';
import { GatewayServer } from '../src/server.ts';
import {
  ANSWER,
  ANY_PORT,
  CORRELATION,
  DOUBLED,
  FAIL,
  FACTOR,
  GATEWAY_PATH,
  INPUT,
  NOTHING,
  OTHER_PATH,
  PING,
  SOCKET,
  ask,
  collect,
  colonParser,
  expectAnswered,
  expectOneReplyEach,
  nestAnswersExceptions,
  nextMessage,
  open,
  parseFailureProbe,
  sendEvent,
  sendOrNothing,
  shapeFrom,
  socketUrl,
  startGateways,
  withoutOnOpen,
} from './support.test.ts';

test('a gateway answers on the Hono server', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(socket, { amount: INPUT });
  } finally {
    socket.close();
    await probe.close();
    await probe.close();
  }
});

test('a gateway answers on the Node transport', async () => {
  const probe = await startGateways(
    new ServerAdapter({ transport: nodeServer() }),
  );
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(socket, { amount: INPUT });
  } finally {
    socket.close();
    await probe.close();
    await probe.close();
  }
});

test('a frame that asked for a correlation is answered with it', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    const answer = await ask(
      socket,
      { amount: INPUT },
      CORRELATION,
    );
    expect(answer).toStrictEqual({
      data: { doubled: DOUBLED },
      event: PING,
      id: CORRELATION,
    });
  } finally {
    socket.close();
    await probe.close();
  }
});

test('one socket closing leaves another socket answering', async () => {
  const probe = await startGateways();
  const first = await open(socketUrl(probe, GATEWAY_PATH));
  const second = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(first, { amount: INPUT });
    first.close();
    await expectAnswered(second, { amount: INPUT });
  } finally {
    second.close();
    await probe.close();
  }
});

test('each gateway path is served on a route of its own', async () => {
  const probe = await startGateways();
  const other = await open(socketUrl(probe, OTHER_PATH));
  try {
    const answer = await ask(other, {});
    expect(answer).toStrictEqual({
      data: { path: OTHER_PATH },
      event: PING,
    });
  } finally {
    other.close();
    await probe.close();
  }
});

test('closing without a client ever connecting is not an error', async () => {
  const probe = await startGateways();
  await probe.close();
  await probe.close();
});

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

test('a handler that throws is answered the way Nest answers it', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    const answer = await sendOrNothing(socket, FAIL);
    if (nestAnswersExceptions()) {
      // The shape `BaseWsExceptionFilter.handleError` writes.
      expect(answer).toMatchObject({ event: 'exception' });
      return;
    }
    // Nest 11 answers with `client.emit`, which for a native socket
    // is local: the exception reaches the log and nothing else,
    // exactly as it does on `@nestjs/platform-ws`.
    expect(answer).toBe(NOTHING);
  } finally {
    socket.close();
    await probe.close();
  }
});

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

/**
 * A gateway option upstream reads and hands on is refused, not
 * dropped.
 */
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

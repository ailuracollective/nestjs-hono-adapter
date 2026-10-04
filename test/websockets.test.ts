import { expect, test } from 'bun:test';
import { Injectable, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  firstValueFrom,
  from,
  fromEvent,
  throwError,
  timeout,
} from 'rxjs';

import { ServerAdapter } from '../src/index.ts';
import { HonoWsAdapter } from '../src/ws.ts';

/** The path the gateway fixture listens on. */
const GATEWAY_PATH = '/ws';

/** The event the gateway fixture answers. */
const PING = 'ping';

/** The factor the gateway fixture answers with. */
const FACTOR = 2;

/** The payload the fixture is asked with. */
const INPUT = 3;

/** What the fixture answers when it is asked with INPUT. */
const DOUBLED = INPUT * FACTOR;

/** The frame the fixture answers an uncorrelated ask with. */
const ANSWER = { data: { doubled: DOUBLED }, event: PING };

/** How long a socket is given before a case fails. */
const TIMEOUT_MS = 5000;

/** The correlation an acknowledgement is asked with. */
const CORRELATION = 7;

/** The interface every case binds to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** The other path a gateway fixture listens on. */
const OTHER_PATH = '/other';

/** A gateway with one event, answering with a value. */
@Injectable()
@WebSocketGateway({ path: GATEWAY_PATH })
class PingGateway {
  @SubscribeMessage(PING)
  public ping(
    @MessageBody() data: { readonly amount: number },
  ): { readonly doubled: number } {
    return { doubled: data.amount * FACTOR };
  }
}

/** A second gateway, answering on a path of its own. */
@Injectable()
@WebSocketGateway({ path: OTHER_PATH })
class OtherGateway {
  @SubscribeMessage(PING)
  public ping(): { readonly path: string } {
    return { path: OTHER_PATH };
  }
}

@Module({ providers: [PingGateway, OtherGateway] })
class GatewayModule {}

/** A running application and the interface it serves. */
interface WsProbe {
  readonly app: INestApplication;
  readonly origin: string;
  close: () => Promise<void>;
}

/** The address one gateway path is reached at. */
function socketUrl(probe: WsProbe, path: string): string {
  return `ws://${probe.origin}${path}`;
}

/**
 * Fails a case that waits longer than a socket is given, so a
 * hung upgrade or a missing answer fails the case instead of
 * hanging the suite.
 */
function within<Result>(
  work: Promise<Result>,
  label: string,
): Promise<Result> {
  return firstValueFrom(
    from(work).pipe(
      timeout({
        first: TIMEOUT_MS,
        with: () =>
          throwError(() => new Error(`${label} timed out`)),
      }),
    ),
  );
}

/** Starts the gateway fixture on an ephemeral port. */
async function startGateways(): Promise<WsProbe> {
  const adapter = new ServerAdapter();
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoWsAdapter(adapter));
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return {
    app,
    close: () => app.close(),
    origin: `${LOCALHOST}:${address.port}`,
  };
}

/** Opens one socket and waits for the upgrade to complete. */
async function open(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  const opened = firstValueFrom(
    fromEvent<Event>(socket, 'open'),
  );
  await within(opened, 'the upgrade');
  return socket;
}

/** The next frame the socket is sent, parsed. */
async function nextMessage(
  socket: WebSocket,
): Promise<unknown> {
  const event = await within(
    firstValueFrom(fromEvent<MessageEvent>(socket, 'message')),
    'the answer',
  );
  return JSON.parse(String(event.data)) as unknown;
}

/** Sends one event and answers what the gateway sent back. */
function ask(
  socket: WebSocket,
  data: unknown,
  correlation?: string | number,
): Promise<unknown> {
  const pending = nextMessage(socket);
  const request = { data, event: PING, id: correlation };
  socket.send(JSON.stringify(request));
  return pending;
}

/** Asks one socket and says it answered as the fixture does. */
async function expectAnswered(
  socket: WebSocket,
  data: unknown,
): Promise<void> {
  const answer = await ask(socket, data);
  expect(answer).toStrictEqual(ANSWER);
}

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

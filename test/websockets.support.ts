import { expect, spyOn } from 'bun:test';
import type { Server as HttpServer } from 'node:http';

import { Injectable, Logger, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createNodeWebSocket } from '@hono/node-ws';
import type { WSEvents } from 'hono/ws';
import type { WebSocket as ServerSocket } from 'ws';
import {
  BaseWsExceptionFilter,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import {
  firstValueFrom,
  from,
  fromEvent,
  throwError,
  timeout,
} from 'rxjs';

import { bunAdapter } from './bun-adapter.ts';
import type { ServerAdapter } from '../src/index.ts';
import type { Transport } from '../src/core/transport.ts';
import { nodeServer } from '../src/servers/node.ts';
import { HonoWsAdapter } from '../src/ws/index.ts';
import type {
  MessageParser,
  WsFrame,
} from '../src/ws/client.ts';

/**
 * The disposer a fake install answers, having nothing to
 * release.
 */
const noDisposer = (): void => undefined;

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

/**
 * How long a case waits before deciding a socket said nothing
 * more.
 */
const QUIET_MS = 150;

/** Waits, without a timer the case has to keep track of. */
async function quiet(ms: number): Promise<void> {
  await Bun.sleep(ms);
}

/** The interface every case binds to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** The other path a gateway fixture listens on. */
const OTHER_PATH = '/other';

/** The event the fixture reports the socket it was given on. */
const SOCKET = 'socket';

/**
 * The event the fixture throws on, to answer through Nest's
 * filter.
 */
const FAIL = 'fail';

/** Narrows what a gateway was handed to the object it is. */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads what the socket a handler was given can do, in the
 * values the answer carries rather than the names.
 *
 * `docs/deployment.md` promises `send`, `close`, `on` and
 * `once`. Nest's own exception filter identifies a native
 * WebSocket client by `send` and `readyState` together, so a
 * socket missing either is answered through a channel it does
 * not have.
 */
function shapeFrom(answer: unknown): Record<string, unknown> {
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
}

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

  @SubscribeMessage(SOCKET)
  public socket(@ConnectedSocket() socket: unknown): unknown {
    if (!isRecord(socket)) {
      throw new TypeError('the socket was not an object');
    }
    return {
      close: typeof socket.close,
      on: typeof socket.on,
      once: typeof socket.once,
      readyState: socket.readyState,
      send: typeof socket.send,
    };
  }

  @SubscribeMessage(FAIL)
  public fail(): never {
    throw new WsException('the fixture was asked to fail');
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
  readonly ws: HonoWsAdapter;
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
async function startGateways(
  adapter: ServerAdapter = bunAdapter(),
  options?: { readonly messageParser?: MessageParser },
): Promise<WsProbe> {
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  const ws = new HonoWsAdapter(adapter, options);
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

/**
 * Every frame the socket is sent from now on, in order.
 *
 * `expectAnswered` reads the first answer and stops looking,
 * which hides a second copy of it. A handler bound twice sends
 * the same answer twice, so only a collector that keeps reading
 * sees the duplicate.
 */
function collect(socket: WebSocket): () => unknown[] {
  const frames: unknown[] = [];
  socket.addEventListener('message', (event) => {
    frames.push(JSON.parse(String(event.data)) as unknown);
  });
  return () => frames;
}

/**
 * Says the socket answered each frame exactly once.
 *
 * A handler bound twice answers every frame twice, and the
 * extra copies carry the same content, so only counting them
 * tells the two apart.
 */
async function expectOneReplyEach(
  frames: () => unknown[],
  sent: number[],
): Promise<void> {
  await quiet(QUIET_MS);
  expect(frames()).toStrictEqual(
    sent.map((amount) => ({
      data: { doubled: amount * FACTOR },
      event: PING,
    })),
  );
}

/** Sends one event of the fixture's own and answers what came. */
function sendEvent(
  socket: WebSocket,
  event: string,
): Promise<unknown> {
  const pending = nextMessage(socket);
  socket.send(JSON.stringify({ event }));
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

/**
 * The node transport with a websocket helper that has no
 * `onOpen`, which is what a fetch host passes: Hono runs the
 * factory before the upgrade, so `@hono/cloudflare-workers`
 * types its helper as `Omit<WSEvents, 'onOpen'>`, and the only
 * difference from the case above is the missing event.
 */
function withoutOnOpen(): Transport {
  const base = nodeServer();
  return {
    createServer: base.createServer,
    createWebSocket: (app) => {
      const node = createNodeWebSocket({ app });
      return {
        install: (server): (() => void) => {
          // The same narrowing the island does at src/ws/adapter.ts,
          // where the adapter's own server is handed to this helper.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the helper only reads a handle off it.
          node.injectWebSocket(server as unknown as HttpServer);
          return noDisposer;
        },
        upgradeWebSocket: (factory) =>
          node.upgradeWebSocket((context) => {
            const events = factory(context);
            const kept: WSEvents<ServerSocket> = {};
            if (events.onClose) {
              kept.onClose = events.onClose;
            }
            if (events.onError) {
              kept.onError = events.onError;
            }
            if (events.onMessage) {
              kept.onMessage = events.onMessage;
            }
            return kept;
          }),
      };
    },
    serveStatic: base.serveStatic,
  };
}

/**
 * Whether the installed Nest answers a thrown handler on the
 * client.
 *
 * `BaseWsExceptionFilter` writes through `client.send` from
 * Nest 12 on, picking the transport by `send` and `readyState`.
 * Before that it wrote through `client.emit`, which for a
 * native socket is a local event that never reaches the wire —
 * the official `@nestjs/platform-ws` behaves the same way on
 * 11, measured against it directly. Feature-detected rather
 * than read off a version, so it follows the code that does the
 * writing.
 */
function nestAnswersExceptions(): boolean {
  const candidate: unknown = Reflect.get(
    BaseWsExceptionFilter.prototype,
    'isNativeWebSocket',
  );
  return typeof candidate === 'function';
}

/** What a window that saw no answer resolves to. */
const NOTHING = Symbol('nothing');

/**
 * Sends one event and answers what came, or nothing in a
 * window.
 */
async function sendOrNothing(
  socket: WebSocket,
  event: string,
): Promise<unknown> {
  socket.send(JSON.stringify({ event }));
  const outcome = await Promise.race([
    nextMessage(socket),
    quiet(QUIET_MS).then(() => NOTHING),
  ]);
  if (outcome === NOTHING) {
    return NOTHING;
  }
  return outcome;
}

/**
 * A dialect of the fixture's own: `<event>:<amount>`, which the
 * built-in reader keeps as a single event name.
 */
function colonParser(raw: unknown): WsFrame | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const [event = '', amount = '0'] = raw.split(':');
  return { data: { amount: Number(amount) }, event };
}

/**
 * Watches the adapter's logger, so a case can tell a failure it
 * reported from one it only threw.
 */
function watchLogger(): {
  readonly restore: () => void;
  readonly seen: unknown[];
} {
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
}

/**
 * Opens a gateway whose parser throws, sends one frame, and
 * answers what the socket saw, whether it stayed open, and what
 * the adapter reported.
 */
async function parseFailureProbe(failure: Error): Promise<{
  readonly frames: unknown[];
  readonly open: boolean;
  readonly reported: unknown[];
}> {
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
}

export {
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
};

import { once } from 'node:events';
import { createServer } from 'node:http';

import { expect, test } from 'bun:test';

import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { OnGatewayDisconnect } from '@nestjs/websockets';
import {
  firstValueFrom,
  from,
  fromEvent,
  throwError,
  timeout,
} from 'rxjs';
import type { Server, Socket } from 'socket.io';
import { io as connect } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';

import { ServerAdapter } from '../../../packages/core/src/index.ts';
import { HonoIoAdapter } from '../src/index.ts';
import { bunServer } from '../../../packages/core/src/servers/bun.ts';
import { nodeServer } from '../../../packages/core/src/servers/node.ts';

/** How long a case waits for an event before it fails. */
const TIMEOUT_MS = 4000;

/** How long a case waits before deciding nothing more arrives. */
const QUIET_MS = 200;

/** The interface every case binds to, and connects to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** The namespace the second gateway answers on. */
const ADMIN = '/admin';

/** The room the broadcast case joins. */
const ROOM = 'room1';

/** The greeting the room case hears. */
const GREETING = `hello ${ROOM}`;

/** The events the fixture answers on. */
const PING = 'ping';
const JOIN = 'join';
const SHOUT = 'shout';
const BROADCAST = 'broadcast';
const SHOUTED = 'shouted';

/** The clients a gateway saw go away. */
const gone: string[] = [];

/**
 * Fails a case that waits longer than a socket is given, so a
 * missing answer fails the case instead of hanging the suite.
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

/** The next value the client is sent on one event. */
function received<Value>(
  socket: ClientSocket,
  event: string,
): Promise<Value> {
  return within(
    firstValueFrom(fromEvent<Value>(socket, event)),
    `the ${event} event`,
  );
}

/** Waits, without a timer the case has to keep track of. */
async function quiet(): Promise<void> {
  await Bun.sleep(QUIET_MS);
}

@WebSocketGateway()
class EchoGateway implements OnGatewayDisconnect {
  @WebSocketServer() public server!: Server;

  @SubscribeMessage(PING)
  public onPing(@MessageBody() data: unknown): unknown {
    return { echo: data };
  }

  /**
   * Joins a room and greets it.
   *
   * Socket.io v4 joins asynchronously, so an emit that runs
   * before `join` resolves reaches nobody. The case below fails
   * if this ever stops being awaited.
   */
  @SubscribeMessage(JOIN)
  public async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string,
  ): Promise<string> {
    await client.join(room);
    this.server.to(room).emit(BROADCAST, GREETING);
    return 'joined';
  }

  /** Answers on an event of its own rather than the frame's. */
  @SubscribeMessage(SHOUT)
  public onShout(@MessageBody() text: string): {
    data: string;
    event: string;
  } {
    return { data: text, event: SHOUTED };
  }

  public handleDisconnect(client: Socket): void {
    gone.push(client.id);
  }
}

@WebSocketGateway({ namespace: ADMIN })
class AdminGateway {
  @SubscribeMessage('who')
  public onWho(): string {
    return 'admin';
  }
}

@Module({ providers: [AdminGateway, EchoGateway] })
class GatewayModule {}

/** The application, and the address its gateways answer on. */
interface Started {
  readonly close: () => Promise<void>;
  readonly url: string;
}

/** Starts the application with the socket.io adapter bound. */
async function start(): Promise<Started> {
  const adapter = new ServerAdapter({
    transport: nodeServer(),
  });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoIoAdapter(app));
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError('the adapter answered with no port');
  }
  return {
    close: () => app.close(),
    url: `http://${LOCALHOST}:${address.port}`,
  };
}

/** Opens a client and waits for it to be connected. */
async function open(
  url: string,
  namespace = '',
): Promise<ClientSocket> {
  const socket = connect(`${url}${namespace}`, {
    transports: ['websocket'],
  });
  await received(socket, 'connect');
  return socket;
}

/** The message the application refused to start with, or none. */
async function refusalOf(
  app: INestApplication,
): Promise<string> {
  try {
    await app.listen(ANY_PORT, LOCALHOST);
  } catch (error) {
    return String(error);
  }
  return '';
}

test('a gateway answers the acknowledgement of a frame', async () => {
  const started = await start();
  const client = await open(started.url);
  expect(
    await client.emitWithAck(PING, { count: 1 }),
  ).toStrictEqual({ echo: { count: 1 } });
  client.close();
  await started.close();
});

/**
 * Joins a room from one of two clients and reports what each
 * heard.
 *
 * The listeners come first, and it matters: the gateway emits
 * the broadcast while it is still handling the frame, so the
 * emit and the acknowledgement travel in that order on one
 * connection. A listener attached after the acknowledgement
 * resolved would miss the frame, which looks like an adapter
 * that drops broadcasts and is not.
 */
async function roomBroadcast(
  started: Started,
): Promise<string[]> {
  const heard: string[] = [];
  const listen = (text: string): void => {
    heard.push(text);
  };
  const [inside, outside] = await Promise.all([
    open(started.url),
    open(started.url),
  ]);
  inside.on(BROADCAST, listen);
  outside.on(BROADCAST, listen);
  expect(await inside.emitWithAck(JOIN, ROOM)).toBe('joined');
  await quiet();
  inside.close();
  outside.close();
  return heard;
}

test('a room broadcast reaches only the client in the room', async () => {
  const started = await start();
  expect(await roomBroadcast(started)).toStrictEqual([
    GREETING,
  ]);
  await started.close();
});

test('a handler answers on an event of its own', async () => {
  const started = await start();
  const client = await open(started.url);
  const answer = received<string>(client, SHOUTED);
  // A handler that answers on an event of its own sends no
  // acknowledgement, so this frame is emitted rather than
  // awaited as one.
  client.emit(SHOUT, 'hey');
  expect(await answer).toBe('hey');
  client.close();
  await started.close();
});

test('a disconnect reaches the gateway', async () => {
  const started = await start();
  const client = await open(started.url);
  const { id } = client;
  if (id === undefined) {
    throw new TypeError('the client connected with no id');
  }
  client.close();
  await quiet();
  expect(gone).toContain(id);
  await started.close();
});

test('a namespaced gateway answers on its namespace', async () => {
  const started = await start();
  const client = await open(started.url, ADMIN);
  expect(await client.emitWithAck('who', 'me')).toBe('admin');
  client.close();
  await started.close();
});

test('a transport with no node server is refused by name', async () => {
  const adapter = new ServerAdapter({ transport: bunServer() });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoIoAdapter(app));
  const refusal = await refusalOf(app);
  expect(refusal).toMatch(/needs a Node http\.Server/u);
});

test('closing the application settles', async () => {
  const started = await start();
  const client = await open(started.url);
  client.close();
  await started.close();
  expect(true).toBe(true);
});

test('attachment without an HTTP server is refused', () => {
  const adapter = new HonoIoAdapter();
  expect(() => adapter.create(ANY_PORT)).toThrow(
    /needs a Node http\.Server/u,
  );
});

/** Starts a native HTTP listener on an ephemeral port. */
async function listeningServer(): Promise<
  ReturnType<typeof createServer>
> {
  const listener = createServer();
  listener.listen(ANY_PORT, LOCALHOST);
  await within(once(listener, 'listening'), 'HTTP listener');
  return listener;
}

/**
 * Reserves and releases a nonzero port for a standalone
 * gateway.
 */
async function gatewayPort(): Promise<number> {
  const listener = await listeningServer();
  const address = listener.address();
  const closed = once(listener, 'close');
  listener.close();
  await within(closed, 'port release');
  if (address === null || typeof address === 'string') {
    throw new TypeError(
      'the port reservation answered with no port',
    );
  }
  return address.port;
}

/** Closes either the root or its namespace through the adapter. */
function shutdownGateway(
  adapter: HonoIoAdapter,
  io: Server,
  namespace: string,
): Promise<void> {
  if (namespace === '') {
    return within(adapter.close(io), 'gateway shutdown');
  }
  return within(
    adapter.close(io.of(namespace)),
    'namespace shutdown',
  );
}

/** Connects a client and checks that shutdown disconnects it. */
async function disconnectGateway(
  adapter: HonoIoAdapter,
  io: Server,
  options: {
    readonly namespace: string;
    readonly port: number;
  },
): Promise<void> {
  const { namespace, port } = options;
  io.of(namespace);
  const client = await open(
    `http://${LOCALHOST}:${port}`,
    namespace,
  );
  try {
    const disconnected = received(client, 'disconnect');
    await shutdownGateway(adapter, io, namespace);
    await disconnected;
  } finally {
    client.close();
  }
}

test.each(['', ADMIN])(
  'closing a standalone gateway releases its listener (namespace: %s)',
  async (namespace) => {
    const port = await gatewayPort();
    const adapter = new HonoIoAdapter();
    const io = adapter.createIOServer(port);
    try {
      await within(
        once(io.httpServer, 'listening'),
        'gateway listener',
      );
      await disconnectGateway(adapter, io, { namespace, port });
      expect(io.httpServer.listening).toBe(false);
    } finally {
      await io.close();
    }
  },
);

test('closing an attached gateway leaves the shared listener open', async () => {
  const listener = await listeningServer();
  try {
    const adapter = new HonoIoAdapter(listener);
    const io = adapter.createIOServer(ANY_PORT);
    await within(
      adapter.close(io.of(ADMIN)),
      'attached gateway shutdown',
    );
    expect(listener.listening).toBe(true);
  } finally {
    const closed = once(listener, 'close');
    listener.close();
    await within(closed, 'shared listener shutdown');
  }
});

/**
 * The clients of an attached gateway, which is the case the
 * early return serves: that listener is not ours to close, so
 * the close cannot lean on socket.io's own `close()` to let the
 * clients go. It has to do that itself, and this is what fails
 * if it ever stops.
 */
/** The port a listening server answers on. */
function portOf(
  listener: ReturnType<typeof createServer>,
): number {
  const address = listener.address();
  if (address === null || typeof address === 'string') {
    throw new TypeError('the listener answered with no port');
  }
  return address.port;
}

test('closing an attached gateway disconnects its clients', async () => {
  const listener = await listeningServer();
  try {
    const adapter = new HonoIoAdapter(listener);
    const io = adapter.createIOServer(ANY_PORT);
    await disconnectGateway(adapter, io, {
      namespace: '',
      port: portOf(listener),
    });
    expect(listener.listening).toBe(true);
  } finally {
    const closed = once(listener, 'close');
    listener.close();
    await within(closed, 'shared listener shutdown');
  }
});

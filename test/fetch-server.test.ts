/**
 * The fetch transport, exercised without a host.
 *
 * A fetch host hands the application a Web `Request` and
 * expects a Web `Response`; nothing listens. These cases pin
 * that down: a route answers through `fetchHandler`, and the
 * capabilities the transport does not port are refused rather
 * than silently answered.
 */

import { expect, mock, test } from 'bun:test';
import { HttpStatus, Injectable, Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import {
  fetchHandler,
  fetchServer,
  webSocketFromHost,
} from '../src/servers/fetch.ts';
import type {
  FetchHandlerOptions,
  FetchHostWebSocket,
} from '../src/servers/fetch.ts';
import { ServerAdapter } from '../src/index.ts';
import type { TrustProxy } from '../src/index.ts';
import type { WebSocketSupport } from '../src/core/transport.ts';
import { HonoWsAdapter } from '../packages/ws/src/index.ts';
import { ProbeModule, SseModule } from './support.ts';

/** The state a socket is in once it accepts a send. */
const OPEN_STATE = 1;

/**
 * How long a case waits for an answer before deciding none
 * came.
 */
const QUIET_MS = 150;

/** What the gateway fixture multiplies by. */
const DOUBLING = 2;

/** What the gateway fixture is asked with. */
const INPUT = 3;

/** Waits, without a timer the case has to keep track of. */
async function quiet(ms: number): Promise<void> {
  await Bun.sleep(ms);
}

/** A running application answered through the fetch handler. */
interface FetchProbe {
  readonly fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

/** Starts one module on the fetch transport. */
async function startFetch(
  module: Type<unknown>,
  handler: FetchHandlerOptions = {},
  trustProxy: TrustProxy = false,
): Promise<FetchProbe> {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
    trustProxy,
  });
  const app = await NestFactory.create(module, adapter, {
    logger: false,
  });
  await app.init();
  return {
    close: () => app.close(),
    fetch: fetchHandler(adapter.getHono(), handler),
  };
}

test('a route answers through the fetch handler', async () => {
  const probe = await startFetch(ProbeModule);
  try {
    const ping = await probe.fetch(
      new Request('http://host.test/ping'),
    );
    expect(ping.status).toBe(HttpStatus.OK);

    const echo = await probe.fetch(
      new Request('http://host.test/echo', {
        body: JSON.stringify({ ping: true }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
    expect(echo.status).toBe(HttpStatus.CREATED);
    expect(await echo.json()).toStrictEqual({ ping: true });
  } finally {
    await probe.close();
  }
});

test('listen() without a callback throws the refusal', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  adapter.initHttpServer({});
  const server = adapter.getHttpServer();
  expect(() => {
    server.listen(0);
  }).toThrow('The fetch transport cannot listen');
  expect(() => {
    server.listen(0, 'localhost');
  }).toThrow('The fetch transport cannot listen');
});

test.each([false, true])(
  'listen() reports refusal through its callback (hostname: %j)',
  (withHostname) => {
    const adapter = new ServerAdapter({
      transport: fetchServer(),
    });
    adapter.initHttpServer({});
    const server = adapter.getHttpServer();
    const answer = mock((): void => {
      // The mock records the refusal for the assertions below.
    });
    expect(() => {
      if (withHostname) {
        server.listen(0, 'localhost', answer);
      } else {
        server.listen(0, answer);
      }
    }).not.toThrow();
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(expect.any(Error));
    expect(answer).toHaveBeenCalledWith(
      new Error(
        'The fetch transport cannot listen: the fetch host owns the ' +
          'request loop. Export fetchHandler() and give it to the host.',
      ),
    );
  },
);

test('listen() answers with the reason instead of waiting', async () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const app = await NestFactory.create(ProbeModule, adapter, {
    logger: false,
  });
  try {
    let refusal = '';
    try {
      await app.listen(0);
    } catch (error) {
      if (error instanceof Error) {
        refusal = error.message;
      }
    }
    expect(refusal).toContain('fetch host');
  } finally {
    await app.close();
  }
});

test('untrusted fetch headers cannot supply the client address', async () => {
  const probe = await startFetch(ProbeModule);
  try {
    const response = await probe.fetch(
      new Request('http://host.test/request', {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
        },
      }),
    );
    expect(response.status).toBe(HttpStatus.OK);
    const body: unknown = await response.json();
    expect(body).not.toHaveProperty('ip');
    expect(body).toMatchObject({ ips: [] });
  } finally {
    await probe.close();
  }
});

test('a trusted host address takes precedence over untrusted headers', async () => {
  const probe = await startFetch(ProbeModule, {
    clientAddress: () => '192.0.2.1',
  });
  try {
    const response = await probe.fetch(
      new Request('http://host.test/request', {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1',
        },
      }),
    );
    expect(await response.json()).toMatchObject({
      ip: '192.0.2.1',
      ips: [],
    });
  } finally {
    await probe.close();
  }
});

test.each([
  {
    headers: { 'cf-connecting-ip': '203.0.113.7' },
    ip: '203.0.113.7',
    ips: [],
    trust: false,
  },
  {
    headers: { 'x-forwarded-for': '198.51.100.1' },
    ip: undefined,
    ips: [],
    trust: false,
  },
  {
    headers: { 'x-forwarded-for': '198.51.100.1' },
    ip: '198.51.100.1',
    ips: ['198.51.100.1'],
    trust: true,
  },
  { headers: {}, ip: undefined, ips: [], trust: true },
  {
    headers: {
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1',
    },
    ip: '198.51.100.1',
    ips: ['198.51.100.1'],
    trust: true,
  },
] satisfies readonly {
  headers: Record<string, string>;
  ip: string | undefined;
  ips: string[];
  trust: boolean;
}[])(
  'an opted-in header resolves with proxy policy: %j',
  async ({ headers, ip, ips, trust }) => {
    const probe = await startFetch(
      ProbeModule,
      {
        clientAddress: (request) =>
          request.headers.get('cf-connecting-ip') ?? undefined,
      },
      trust,
    );
    try {
      const response = await probe.fetch(
        new Request('http://host.test/request', { headers }),
      );
      const body: unknown = await response.json();
      if (ip === undefined) {
        expect(body).not.toHaveProperty('ip');
      } else {
        expect(body).toMatchObject({ ip });
      }
      expect(body).toMatchObject({ ips });
    } finally {
      await probe.close();
    }
  },
);

test('trusted forwarded headers work without a host resolver', async () => {
  const probe = await startFetch(ProbeModule, {}, true);
  try {
    const response = await probe.fetch(
      new Request('http://host.test/request', {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1',
        },
      }),
    );
    expect(await response.json()).toMatchObject({
      ip: '198.51.100.1',
      ips: ['198.51.100.1'],
    });
  } finally {
    await probe.close();
  }
});

test('a stream answers through the fetch handler', async () => {
  const probe = await startFetch(SseModule);
  try {
    const stream = await probe.fetch(
      new Request('http://host.test/sse/open'),
    );
    expect(stream.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    if (stream.body !== null) {
      await stream.body.cancel();
    }
  } finally {
    await probe.close();
  }
});

test('a capability the fetch transport does not port is refused', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const transport = adapter.getTransport();
  expect(() => {
    transport.serveStatic({
      index: 'index.html',
      root: './public',
    });
  }).toThrow(TypeError);
  const upgrade = transport.createWebSocket;
  if (upgrade === undefined) {
    throw new TypeError(
      'the fetch transport carries no websocket helper',
    );
  }
  expect(() => {
    upgrade(adapter.getHono());
  }).toThrow(TypeError);
});

/** A host helper that answers an upgrade with nothing. */
const idleHelper: FetchHostWebSocket = () => () =>
  Promise.resolve();

/** The websocket surface the adapter built for one transport. */
function supportOf(adapter: ServerAdapter): WebSocketSupport {
  const transport = adapter.getTransport();
  const factory = transport.createWebSocket;
  if (factory === undefined) {
    throw new TypeError(
      'the transport carried no websocket helper',
    );
  }
  return factory(adapter.getHono());
}

test('a host helper becomes the option, with nothing to install', () => {
  const adapter = new ServerAdapter({
    transport: fetchServer({
      upgradeWebSocket: webSocketFromHost(idleHelper),
    }),
  });
  const support = supportOf(adapter);
  expect(support.upgradeWebSocket).toBe(idleHelper);
  // A fetch host is handed requests, so the `install` this
  // transport asks for can only ever do nothing — the answer is a
  // disposer, and calling it is what a real release would do.
  const release = support.install(adapter.getHttpServer());
  expect(typeof release).toBe('function');
  // A fetch host has nothing to release, so the disposer the
  // transport answered with must do nothing and not throw.
  release();
});
/** A socket a host helper drives, with the frames it was sent. */
class DrivenSocket {
  public readonly sent: string[] = [];
  public readonly readyState: number = OPEN_STATE;

  public close(): void {
    // The case drives the frames; there is nothing to close.
  }

  public send(data: string): void {
    this.sent.push(data);
  }
}

/**
 * A host helper that answers the upgrade and keeps the event
 * the factory handed it, so a case can push a frame through it
 * — what a real host does when the client sends one.
 */
class DrivenHost {
  public deliver: ((data: unknown) => void) | undefined =
    undefined;
  private readonly socket = new DrivenSocket();

  public readonly helper: FetchHostWebSocket =
    (createEvents) => (context) => {
      const { onMessage } = createEvents(context);
      this.deliver = (data): void => {
        if (onMessage === undefined) {
          return;
        }
        // The socket stands in for the runtime's own; the events
        // only read `send`, `close` and `readyState` off it.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a driven socket is not a WSContext.
        onMessage({ data }, this.socket as never);
      };
      return Promise.resolve(
        new Response(undefined, {
          status: HttpStatus.SWITCHING_PROTOCOLS,
        }),
      );
    };

  /** The frames the gateway answered with, parsed. */
  public frames(): unknown[] {
    return this.socket.sent.map(
      (frame): unknown => JSON.parse(frame) as unknown,
    );
  }
}

/** A gateway fixture, served through the host helper. */
@Injectable()
@WebSocketGateway({ path: '/ws' })
class PingGateway {
  @SubscribeMessage('ping')
  public ping(
    @MessageBody() data: { readonly amount: number },
  ): { readonly doubled: number } {
    return { doubled: data.amount * DOUBLING };
  }
}

@Module({ providers: [PingGateway] })
class GatewayModule {}

/** A gateway running on the fetch transport, and how to stop it. */
interface GatewayProbe {
  readonly fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

/**
 * Starts a gateway on the fetch transport, over one host
 * helper.
 */
async function startGateway(
  host: DrivenHost,
): Promise<GatewayProbe> {
  const adapter = new ServerAdapter({
    transport: fetchServer({
      upgradeWebSocket: webSocketFromHost(host.helper),
    }),
  });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoWsAdapter(adapter));
  await app.init();
  return {
    close: () => app.close(),
    fetch: fetchHandler(adapter.getHono()),
  };
}

/**
 * Upgrades, pushes one frame through the gateway, answers what
 * came.
 */
async function frameThrough(
  probe: GatewayProbe,
  host: DrivenHost,
): Promise<unknown[]> {
  const upgraded = await probe.fetch(
    new Request('http://host.test/ws'),
  );
  expect(upgraded.status).toBe(HttpStatus.SWITCHING_PROTOCOLS);
  if (host.deliver === undefined) {
    throw new TypeError('the upgrade did not reach the host');
  }
  host.deliver(
    JSON.stringify({
      data: { amount: INPUT },
      event: 'ping',
    }),
  );
  await quiet(QUIET_MS);
  return host.frames();
}

test('a gateway served through the host helper answers a frame', async () => {
  const host = new DrivenHost();
  const probe = await startGateway(host);
  try {
    expect(await frameThrough(probe, host)).toStrictEqual([
      { data: { doubled: INPUT * DOUBLING }, event: 'ping' },
    ]);
  } finally {
    await probe.close();
  }
});

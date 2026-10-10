/**
 * The fetch transport, exercised without a host.
 *
 * A fetch host hands the application a Web `Request` and
 * expects a Web `Response`; nothing listens. These cases pin
 * that down: a route answers through `fetchHandler`, and the
 * capabilities the transport does not port are refused rather
 * than silently answered.
 */

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  fetchHandler,
  fetchServer,
} from '../src/servers/fetch.ts';
import { ServerAdapter } from '../src/index.ts';
import { ProbeModule, SseModule } from './support.ts';

/** A running application answered through the fetch handler. */
interface FetchProbe {
  readonly fetch: (request: Request) => Promise<Response>;
  close: () => Promise<void>;
}

/** Starts one module on the fetch transport. */
async function startFetch(
  module: Type<unknown>,
): Promise<FetchProbe> {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const app = await NestFactory.create(module, adapter, {
    logger: false,
  });
  await app.init();
  return {
    close: () => app.close(),
    fetch: fetchHandler(adapter.getHono()),
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

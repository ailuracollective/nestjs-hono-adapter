import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';

import type { NestEnv } from '../src/index.ts';
import { guardBridge } from '../src/features/guard-bridge.ts';
import { startProbe } from './support.ts';

/** The answer a request gets once the server is closing. */
const REFUSED = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
};

/**
 * A CORS step that does nothing, standing in for the one an
 * application that never enables CORS would carry.
 */
const noCorsStep: MiddlewareHandler<NestEnv> = (
  _context,
  next,
) => next();

/** What an application that never enabled CORS reports. */
function noCorsEnabled(): boolean {
  return false;
}

/** An application that reports whether it is shutting down. */
function probeApp(isClosing: () => boolean): Hono<NestEnv> {
  const app = new Hono<NestEnv>();
  app.use(
    '*',
    guardBridge({
      closing: isClosing,
      cors: noCorsStep,
      corsEnabled: noCorsEnabled,
    }),
  );
  app.get('/ping', (context) => context.text('pong'));
  return app;
}

test('a request is answered while the server is not closing', async () => {
  const response = await probeApp(() => false).request('/ping');
  expect(response.status).toBe(HttpStatus.OK);
  expect(await response.text()).toBe('pong');
});

test('a request that arrives while closing is refused', async () => {
  const response = await probeApp(() => true).request('/ping');
  expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  expect(await response.json()).toStrictEqual(REFUSED);
  expect(response.headers.get('connection')).toBe('close');
});

/**
 * The window the refusal covers is Nest's own: the hooks a
 * deployment runs while it drains are the reason the option
 * exists, so the adapter has to know it is closing before those
 * hooks run rather than when the server closes at the end of
 * them. This case needs a real connection, because that is
 * where the flag has to be answering.
 */
test('the refusal starts when shutdown starts, not when the server closes', async () => {
  const probe = await startProbe({
    application: { return503OnClosing: true },
  });
  try {
    const running = await probe.respond('/ping');
    expect(running.status).toBe(HttpStatus.OK);

    probe.adapter.beforeClose();

    const draining = await probe.respond('/ping');
    expect(draining.status).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(draining.headers.get('connection')).toBe('close');
  } finally {
    await probe.close();
  }
});

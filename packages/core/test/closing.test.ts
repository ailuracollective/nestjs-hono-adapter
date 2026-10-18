import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';

import type { NestEnv } from '#adapter/index';
import { guardStep } from '#adapter/features/front-steps/index';
import { startProbe } from './support/index.ts';

const REFUSED = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
};

const noCorsStep: MiddlewareHandler<NestEnv> = (_context, next) => next();

const noCorsEnabled = (): boolean => false;

const probeApp = (isClosing: () => boolean): Hono<NestEnv> => {
  const app = new Hono<NestEnv>();
  app.use('*', guardStep({ closing: isClosing, cors: noCorsStep, corsEnabled: noCorsEnabled }));
  app.get('/ping', (context) => context.text('pong'));
  return app;
};

test('a request that arrives while closing is refused', async () => {
  const response = await probeApp(() => true).request('/ping');
  expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  expect(await response.json()).toStrictEqual(REFUSED);
  expect(response.headers.get('connection')).toBe('close');
});

test('a refusal carries the headers the real CORS middleware set', async () => {
  const probe = await startProbe({
    application: { return503OnClosing: true },
    configure: (app) => {
      app.enableCors();
    },
  });
  try {
    probe.adapter.beforeClose();

    const draining = await probe.respond('/ping', { headers: { origin: 'https://example.com' } });
    expect(draining.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(draining.headers.get('access-control-allow-origin')).toBe('*');
    expect(draining.headers.get('connection')).toBe('close');
  } finally {
    await probe.close();
  }
});

test('the refusal starts when shutdown starts, not when the server closes', async () => {
  const probe = await startProbe({
    application: { return503OnClosing: true },
  });
  try {
    const running = await probe.respond('/ping');
    expect(running.status).toBe(HttpStatus.OK);

    probe.adapter.beforeClose();

    const draining = await probe.respond('/ping');
    expect(draining.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(draining.headers.get('connection')).toBe('close');
  } finally {
    await probe.close();
  }
});

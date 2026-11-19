import { expect, test } from 'bun:test';
import { FITTED_END } from '@ailura/nestjs-hono-adapter';
import type { BridgeTarget } from '@ailura/nestjs-hono-adapter';
import type { Server } from '#adapter/core/ports/server';
import { bunServer } from '#adapter/servers/bun';
import { Hono } from 'hono';

import { MOUNTED } from '#inertia/symbols';
import { fitSurface } from '#inertia/surface';

const OK = 200;

const noop = (): void => {
  /* The surface only reads the target's identity. */
};

const targetOver = (): BridgeTarget => ({
  adapter: {
    redirect: noop,
    reply: noop,
  },
  hono: new Hono(),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the surface never calls the server.
  server: () => ({}) as unknown as Server,
  transport: bunServer(),
});

const endThroughSurface = async (args: unknown[]): Promise<unknown> => {
  const target = targetOver();
  Reflect.set(target.adapter, MOUNTED, true);
  fitSurface(target);
  let sent: unknown = 'not sent';
  target.hono.get('/', (context) => {
    Reflect.set(context, 'send', (body: unknown): void => {
      sent = body;
    });
    const end: unknown = Reflect.get(context, 'end');
    if (typeof end !== 'function') throw new Error('the surface did not fit end');
    expect(Reflect.get(end, FITTED_END)).toBe(true);
    Reflect.apply(end, context, args);
    return context.text('ok');
  });
  const response = await target.hono.request('/');
  expect(response.status).toBe(OK);
  return sent;
};

test('the fitted end forwards a body to send', async () => {
  expect(await endThroughSurface(['transformed by Vite'])).toBe('transformed by Vite');
});

test('the fitted end treats a callback as no body', async () => {
  expect(await endThroughSurface([(): number => 0])).toBeUndefined();
});

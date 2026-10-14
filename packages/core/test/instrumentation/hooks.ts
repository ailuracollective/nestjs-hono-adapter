import { expect } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { Hono } from 'hono';

import type { NestEnv } from '#adapter/index';
import { instrumentationStep } from '#adapter/features/front-steps/index';
import type {
  OnRequestHook,
  OnResponseHook,
} from '#adapter/features/front-steps/index';

interface ProbeHooks {
  readonly onRequest?: OnRequestHook;
  readonly onResponse?: OnResponseHook;
}

/** Builds an app with the instrumentation step. */
const probeApp = (
  hooks: ProbeHooks,
  order: string[] = [],
): Hono<NestEnv> => {
  const app = new Hono<NestEnv>();
  app.use(
    '*',
    instrumentationStep({
      onRequest: () => hooks.onRequest,
      onResponse: () => hooks.onResponse,
      trustProxy: false,
    }),
  );
  app.get('/ping', (context) => {
    order.push('route');
    return context.text('pong');
  });
  return app;
};

/** Checks the answer the route gave after completion. */
const expectPong = async (
  response: Response,
): Promise<void> => {
  expect(response.status).toBe(HttpStatus.OK);
  expect(await response.text()).toBe('pong');
};

export { expectPong, probeApp };

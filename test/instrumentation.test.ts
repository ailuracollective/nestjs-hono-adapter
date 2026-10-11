import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { Hono } from 'hono';

import type { NestEnv } from '../src/index.ts';
import { instrumentationBridge } from '../src/features/guard-bridge.ts';
import type {
  OnRequestHook,
  OnResponseHook,
} from '../src/features/guard-bridge.ts';

/** What the instrumentation step is configured with. */
interface ProbeHooks {
  readonly onRequest?: OnRequestHook;
  readonly onResponse?: OnResponseHook;
}

/**
 * An app carrying the instrumentation step in front of one
 * route, which records that it ran.
 */
function probeApp(
  hooks: ProbeHooks,
  order: string[] = [],
): Hono<NestEnv> {
  const app = new Hono<NestEnv>();
  app.use(
    '*',
    instrumentationBridge({
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
}

test('a request reaches its route with no hook registered', async () => {
  const response = await probeApp({}).request('/ping');
  expect(response.status).toBe(HttpStatus.OK);
  expect(await response.text()).toBe('pong');
});

test('the request hook reads the request the route will read', async () => {
  const seen: string[] = [];
  const app = probeApp({
    onRequest: (request, _response, done) => {
      seen.push(`${request.method} ${request.originalUrl}`);
      done();
    },
  });
  const response = await app.request('/ping');
  expect(seen).toStrictEqual(['GET /ping']);
  expect(response.status).toBe(HttpStatus.OK);
});

test('the route waits for the hook to continue', async () => {
  const order: string[] = [];
  const app = probeApp(
    {
      onRequest: (_request, _response, done) => {
        order.push('hook');
        queueMicrotask(() => {
          order.push('continued');
          done();
        });
      },
    },
    order,
  );
  await app.request('/ping');
  expect(order).toStrictEqual(['hook', 'continued', 'route']);
});

test('the response hook runs once the route answered', async () => {
  const order: string[] = [];
  const app = probeApp(
    {
      onResponse: (request, response) => {
        order.push(
          `response ${request.method}`,
          typeof response.setHeader,
        );
      },
    },
    order,
  );
  const response = await app.request('/ping');
  expect(order).toStrictEqual([
    'route',
    'response GET',
    'function',
  ]);
  expect(response.status).toBe(HttpStatus.OK);
});

test('a response hook that fails does not change the answer', async () => {
  const app = probeApp({
    onResponse: () => {
      throw new Error('late');
    },
  });
  const response = await app.request('/ping');
  expect(response.status).toBe(HttpStatus.OK);
  expect(await response.text()).toBe('pong');
});

test('a request hook that fails reaches the error path', async () => {
  const app = probeApp({
    onRequest: () => {
      throw new Error('early');
    },
  });
  const response = await app.request('/ping');
  expect(response.status).toBe(
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
});

import { expect, spyOn, test } from 'bun:test';
import { HttpStatus, Logger } from '@nestjs/common';
import { Hono } from 'hono';

import type { NestEnv } from '../src/index.ts';
import { instrumentationStep } from '../src/features/front-steps.ts';
import type {
  OnRequestHook,
  OnResponseHook,
} from '../src/features/front-steps.ts';

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

test('done releases the route while the hook promise is pending', async () => {
  const { promise, resolve } =
    Promise.withResolvers<undefined>();
  const order: string[] = [];
  const app = probeApp(
    {
      onRequest: (_request, _response, done) => {
        order.push('hook');
        done();
        return promise;
      },
    },
    order,
  );
  const pending = app.request('/ping');
  try {
    await Bun.sleep(0);
    expect(order).toStrictEqual(['hook', 'route']);
    await pending;
  } finally {
    resolve();
    await pending;
  }
});

test.each([
  {
    name: 'promise',
    wrap: (promise: Promise<void>): unknown => promise,
  },
  {
    name: 'thenable object',
    wrap: (promise: Promise<void>): unknown => ({
      // oxlint-disable-next-line unicorn/no-thenable -- this fixture verifies hooks returning a foreign thenable.
      then: promise.then.bind(promise),
    }),
  },
  {
    name: 'thenable function',
    wrap: (promise: Promise<void>): unknown =>
      Object.assign(() => promise, {
        // oxlint-disable-next-line unicorn/no-thenable -- callable thenables must also be awaited.
        then: promise.then.bind(promise),
      }),
  },
])(
  'the route waits for a deferred $name hook',
  async ({ wrap }) => {
    const { promise, resolve } =
      Promise.withResolvers<undefined>();
    const order: string[] = [];
    const app = probeApp(
      {
        onRequest: () => {
          order.push('hook');
          return wrap(promise);
        },
      },
      order,
    );
    const pending = app.request('/ping');
    await Bun.sleep(0);
    expect(order).toStrictEqual(['hook']);
    resolve();
    const response = await pending;
    expect(order).toStrictEqual(['hook', 'route']);
    expect(response.status).toBe(HttpStatus.OK);
  },
);

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
  const failure = new Error('early');
  const order: string[] = [];
  const caught: Error[] = [];
  const app = probeApp(
    {
      onRequest: () => {
        throw failure;
      },
      onResponse: () => {
        order.push('response');
      },
    },
    order,
  );
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Hono registers its error handler through a callback.
  app.onError((error, context) => {
    caught.push(error);
    order.push('error');
    return context.text(
      'hook failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
  const response = await app.request('/ping');
  expect(caught[0]).toBe(failure);
  expect(order).toStrictEqual(['response', 'error']);
  expect(response.status).toBe(
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
});

test('a request hook rejection reaches the error path', async () => {
  const failure = new Error('rejected');
  const order: string[] = [];
  const caught: Error[] = [];
  const app = probeApp(
    {
      onRequest: () => Promise.reject(failure),
      onResponse: () => {
        order.push('response');
      },
    },
    order,
  );
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Hono registers its error handler through a callback.
  app.onError((error, context) => {
    caught.push(error);
    order.push('error');
    return context.text(
      'hook failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });
  const response = await app.request('/ping');
  expect(caught[0]).toBe(failure);
  expect(order).toStrictEqual(['response', 'error']);
  expect(response.status).toBe(
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
});

test('an async response hook can change headers before completion', async () => {
  const { promise, resolve } =
    Promise.withResolvers<undefined>();
  const app = probeApp({
    onResponse: async (_request, response) => {
      await promise;
      response.setHeader('x-hook', 'complete');
    },
  });
  const pending = app.request('/ping');
  await Bun.sleep(0);
  resolve();
  const response = await pending;
  expect(response.headers.get('x-hook')).toBe('complete');
});

/** Checks that middleware completion preserved the route answer. */
async function expectPong(response: Response): Promise<void> {
  expect(response.status).toBe(HttpStatus.OK);
  expect(await response.text()).toBe('pong');
}

test('a pending response hook releases the answer and logs a later rejection', async () => {
  const { promise, reject } =
    Promise.withResolvers<undefined>();
  const failure = new Error('after the response');
  const logged = spyOn(
    Logger.prototype,
    'error',
  ).mockImplementation((): void => undefined);
  try {
    const response = await probeApp({
      onResponse: () => promise,
    }).request('/ping');
    await expectPong(response);
    reject(failure);
    await Bun.sleep(0);
    expect(logged.mock.calls).toStrictEqual([
      ['The response hook failed.', failure],
    ]);
  } finally {
    logged.mockRestore();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { probeApp } from '#adapter-test/instrumentation/hooks';

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
  const { promise, resolve } = Promise.withResolvers<undefined>();
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
])('the route waits for a deferred $name hook', async ({ wrap }) => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
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
});

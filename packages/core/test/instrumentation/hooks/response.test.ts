import { expect, spyOn, test } from 'bun:test';
import { HttpStatus, Logger } from '@nestjs/common';

import {
  expectPong,
  probeApp,
} from '#adapter-test/instrumentation/hooks';

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

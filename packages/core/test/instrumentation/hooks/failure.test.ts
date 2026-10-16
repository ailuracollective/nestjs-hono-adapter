import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { probeApp } from '#adapter-test/instrumentation/hooks';

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
    return context.text('hook failed', HttpStatus.INTERNAL_SERVER_ERROR);
  });
  const response = await app.request('/ping');
  expect(caught[0]).toBe(failure);
  expect(order).toStrictEqual(['response', 'error']);
  expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
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
    return context.text('hook failed', HttpStatus.INTERNAL_SERVER_ERROR);
  });
  const response = await app.request('/ping');
  expect(caught[0]).toBe(failure);
  expect(order).toStrictEqual(['response', 'error']);
  expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
});

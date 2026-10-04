import { expect, test } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { Hono } from 'hono';

import type { NodeEnv } from '../src/index.ts';
import { closingBridge } from '../src/core/closing.ts';

/** The answer a request gets once the server is closing. */
const REFUSED = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
};

/** An application that reports whether it is shutting down. */
function probeApp(isClosing: () => boolean): Hono<NodeEnv> {
  const app = new Hono<NodeEnv>();
  app.use('*', closingBridge(isClosing));
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
});

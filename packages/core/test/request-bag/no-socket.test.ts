import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import { toNestRequest } from '#adapter/core/request/request';
import type { NestContext, NestEnv } from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

const NO_REQUEST_CARRIER = {
  server: SYNTHETIC_SERVER,
} satisfies NestEnv['Bindings'];

const contextWithoutCarrier = async (): Promise<NestContext> => {
  const app = new Hono<NestEnv>();
  const captured: NestContext[] = [];
  app.get('/read', (context) => {
    captured.push(context);
    return context.text('ok');
  });
  await app.request('/read', undefined, NO_REQUEST_CARRIER);
  const [context] = captured;
  if (context === undefined) throw new Error('the route did not run');
  return context;
};

test('the fields a socket would fill answer what is missing without one', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  expect(bag.ip).toBeUndefined();
  expect(bag.ips).toStrictEqual([]);
  expect(bag.raw).toBeUndefined();
  expect(bag.socket).toBeUndefined();
  expect(bag.method).toBe('GET');
  expect(bag.path).toBe('/read');
  expect(bag.url).toBe('/read');
  expect(bag.hostname).toBeDefined();
});

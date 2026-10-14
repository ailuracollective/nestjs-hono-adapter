import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import { toNestRequest } from '#adapter/core/request/request';
import type { NestContext, NestEnv } from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

/** A binding that carries no request carrier. */
const NO_REQUEST_CARRIER = {
  server: SYNTHETIC_SERVER,
} satisfies NestEnv['Bindings'];

/** A context reached through a binding with no carrier. */
const contextWithoutCarrier =
  async (): Promise<NestContext> => {
    const app = new Hono<NestEnv>();
    const captured: NestContext[] = [];
    app.get('/read', (context) => {
      captured.push(context);
      return context.text('ok');
    });
    await app.request('/read', undefined, NO_REQUEST_CARRIER);
    const [context] = captured;
    if (context === undefined) {
      throw new Error('the route did not run');
    }
    return context;
  };

test('the address is undefined rather than thrown when none arrived', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  expect(bag.ip).toBeUndefined();
});

test('the forwarded chain is empty when no socket arrived', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  expect(bag.ips).toStrictEqual([]);
});

test('the fields that need the socket still say what is missing', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  expect(() => bag.raw).toThrow('without a carrier');
  expect(() => bag.socket).toThrow('without a carrier');
});

test('a property that needs no socket still answers without one', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  expect(bag.method).toBe('GET');
  expect(bag.path).toBe('/read');
  expect(bag.url).toBe('/read');
  expect(bag.hostname).toBeDefined();
});

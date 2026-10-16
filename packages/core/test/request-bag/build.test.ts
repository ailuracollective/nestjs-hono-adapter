import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import type { IncomingMessage } from 'node:http';

import { RequestCarrier } from '#adapter/core/ports/bindings';
import { toNestRequest } from '#adapter/core/request/request';
import type { Incoming, NestContext, NestEnv } from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- named as the two faces the package publishes, the carrier Nest reads and the `IncomingMessage` a deployment read before the transports split.
const SYNTHETIC_INCOMING = new RequestCarrier(undefined) as unknown as IncomingMessage & Incoming;

interface Reached {
  incoming: number;
}

const contextOver = async (target: string): Promise<{ context: NestContext; reached: Reached }> => {
  const reached: Reached = { incoming: 0 };
  const binding = {
    get incoming(): Incoming {
      reached.incoming += 1;
      return SYNTHETIC_INCOMING;
    },
    server: SYNTHETIC_SERVER,
  } satisfies NestEnv['Bindings'];
  const app = new Hono<NestEnv>();
  const captured: NestContext[] = [];
  app.get('/read', (context) => {
    captured.push(context);
    return context.text('ok');
  });
  await app.request(target, undefined, binding);
  const [context] = captured;
  if (context === undefined) throw new Error('the route did not run');
  return { context, reached };
};

test('the translation builds nothing the route does not read', async () => {
  const { context, reached } = await contextOver('/read?name=ada');
  const bag = toNestRequest(context, { trustProxy: false });
  expect(reached.incoming).toBe(0);
  expect(bag.method).toBe('GET');
  expect(bag.path).toBe('/read');
  expect(bag.url).toBe('/read?name=ada');
  expect(bag.originalUrl).toBe('/read?name=ada');
  expect(reached.incoming).toBe(0);
});

test('a property read twice is built once', async () => {
  const { context, reached } = await contextOver('/read');
  const bag = toNestRequest(context, { trustProxy: false });
  const { hosts } = bag;
  expect(bag.raw).toBe(SYNTHETIC_INCOMING);
  expect(bag.raw).toBe(SYNTHETIC_INCOMING);
  expect(bag.socket).toBe(SYNTHETIC_INCOMING.socket);
  expect(bag.hosts).toBe(hosts);
  expect(bag.ips).toStrictEqual([]);
  expect(reached.incoming).toBe(1);
});

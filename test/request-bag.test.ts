/**
 * What the request translation builds, and what it leaves
 * alone.
 *
 * Nest reads the request as a bag of properties, and the
 * translation used to fill every one of them for every request.
 * These cases pin down the two halves of that: a property a
 * route reads still answers, and a property it never reads is
 * never built — which is what the counting binding below
 * measures.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import { toNestRequest } from '../src/core/request.ts';
import type { NestContext, NodeEnv } from '../src/index.ts';

/**
 * The request no listener sent, which is what the translation
 * reads the raw request and the socket from.
 */
const SYNTHETIC_INCOMING = new IncomingMessage(new Socket());

/** The response made against it, so the binding carries one. */
const SYNTHETIC_OUTGOING = new ServerResponse(
  SYNTHETIC_INCOMING,
);

/** How often the translation reached for the socket. */
interface Reached {
  incoming: number;
}

/**
 * A context the translation can be handed, over a binding that
 * counts how often it is read.
 *
 * A request that arrived would be read through that binding, so
 * the count is what tells a case whether a property was built
 * for a request or for nobody.
 */
async function contextOver(
  target: string,
): Promise<{ context: NestContext; reached: Reached }> {
  const reached: Reached = { incoming: 0 };
  const binding = {
    get incoming(): IncomingMessage {
      reached.incoming += 1;
      return SYNTHETIC_INCOMING;
    },
    get outgoing(): ServerResponse {
      return SYNTHETIC_OUTGOING;
    },
  } satisfies NodeEnv['Bindings'];
  const app = new Hono<NodeEnv>();
  const captured: NestContext[] = [];
  app.get('/read', (context) => {
    captured.push(context);
    return context.text('ok');
  });
  await app.request(target, undefined, binding);
  const [context] = captured;
  if (context === undefined) {
    throw new Error('the route did not run');
  }
  return { context, reached };
}

test('the translation builds nothing the route does not read', async () => {
  const { context, reached } =
    await contextOver('/read?name=ada');
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

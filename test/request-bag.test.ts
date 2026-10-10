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

import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import type { IncomingMessage } from 'node:http';

import { RequestCarrier } from '../src/core/bindings.ts';
import { toNestRequest } from '../src/core/request.ts';
import type {
  Incoming,
  NestContext,
  NestEnv,
} from '../src/index.ts';
import { SYNTHETIC_SERVER } from './bun-bindings.ts';

/**
 * The request no listener sent, which is what the translation
 * reads the raw request and the socket from.
 *
 * It is named as both faces the translation publishes — the
 * carrier Nest reads, and the `IncomingMessage` a deployment
 * read before the transports split — because the cases below
 * compare it to the bag's own properties.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- named as the two faces the package publishes, the carrier Nest reads and the `IncomingMessage` a deployment read before the transports split.
const SYNTHETIC_INCOMING = new RequestCarrier(
  undefined,
) as unknown as IncomingMessage & Incoming;

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

/**
 * A binding with no request carrier in it. The adapter reads
 * `env.incoming` as optional, so a binding that does not carry
 * one is a request with nothing to read the socket from.
 */
// The binding is widened to the type the adapter expects, whose
// `incoming` is required, while the value deliberately leaves it
// absent — which is the case being pinned down.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the widening is the case.
const NO_REQUEST_CARRIER = {
  server: SYNTHETIC_SERVER,
} as unknown as NestEnv['Bindings'];

/**
 * A context reached through that binding.
 *
 * The route has to run, so a case is measuring the translation
 * rather than a request that never arrived.
 */
async function contextWithoutCarrier(): Promise<NestContext> {
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
}

test('the address is undefined rather than thrown when none arrived', async () => {
  const bag = toNestRequest(await contextWithoutCarrier(), {
    trustProxy: false,
  });

  // `ip` is declared `string | undefined`, so this is the answer it
  // owes rather than the one it happens to give when a socket is
  // there. It matters because the default tracker of
  // `@nestjs/throttler` reads this field, and a thrown error there
  // answers 500 instead of throttling.
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

  // `raw` and `socket` cannot be answered at all without one, and
  // their types do not pretend otherwise — so they name the absence
  // rather than handing back `undefined` that would be read as a
  // message somewhere else.
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

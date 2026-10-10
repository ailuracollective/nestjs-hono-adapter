import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { httpServerHandler } from 'cloudflare:node';

import type { Incoming } from '../../../src/index.ts';
import { ServerAdapter } from '../../../src/index.ts';
import { AppModule } from './app.module.ts';

const PORT = 8787;

// `@hono/node-server` replaces the global `Response` with a lighter
// one unless it is told not to, and this platform refuses an answer
// that is not one of its own: it answers 1101 before the application
// sees the request. Turning the replacement off keeps the platform’s
// classes. It is a Workers-only concern — the lighter class is worth
// roughly a third of the CPU an answer costs — so the default stays.
const adapter = new ServerAdapter({
  overrideGlobalObjects: false,
  trustProxy: true,
});

const app = await NestFactory.create(AppModule, adapter, {
  logger: ['error', 'warn'],
});

/**
 * The signal of every request this Worker is answering, filed
 * under the execution context its `fetch` was given.
 *
 * A Worker says a client walked away by aborting that signal,
 * and this platform says it no other way: nothing here closes
 * a connection, and a stream is never cancelled. The signal
 * belongs to the platform’s request, which the application
 * never sees, so it is filed under the one object both sides
 * hold — see `contextOf` for the reading side.
 */
const signals = new WeakMap<object, AbortSignal>();

/**
 * The execution context the platform gave this request, read
 * back off the request the application was handed.
 *
 * `cloudflare:node` builds that request, and the handle it
 * leaves on it is where the platform’s own request context
 * survives. Nothing documents the handle, so it is read
 * defensively: a runtime that stops leaving one leaves the
 * application where it was, which is with no signal at all.
 *
 * The parameter is the adapter’s own carrier type rather
 * than an `IncomingMessage`: the binding is whatever object
 * the runtime attached, and this Worker only reads a handle
 * off it.
 */
function contextOf(incoming: Incoming): object | undefined {
  const held: unknown = Reflect.get(incoming, 'cloudflare');
  if (typeof held !== 'object' || held === null) {
    return undefined;
  }
  if (!('ctx' in held)) {
    return undefined;
  }
  const { ctx } = held;
  return typeof ctx === 'object' && ctx !== null
    ? ctx
    : undefined;
}

adapter.getHono().get('/debug-env', (context) =>
  context.json({
    hasIncoming: Boolean(context.env?.incoming),
    hasSocket: Boolean(context.env?.incoming?.socket),
    remoteAddress:
      context.env?.incoming?.socket?.remoteAddress ?? null,
  }),
);

// An event stream ends when the request it was given ends,
// which on this platform is the only thing left to say the
// client is gone. The signal filed above is what knows.
adapter.getHono().use(async (context, next) => {
  // The adapter publishes the request binding as optional, a
  // fetch host attaching none of its own. This Worker is on
  // the Node path — `cloudflare:node` hands over a message —
  // so the binding is read only when one was attached.
  const { incoming } = context.env;
  if (incoming !== undefined) {
    const holding = contextOf(incoming);
    const signal =
      holding === undefined ? undefined : signals.get(holding);
    signal?.addEventListener('abort', () => {
      incoming.emit('close');
    });
  }
  await next();
});

await app.listen(PORT);

const handler = httpServerHandler({ port: PORT });

export default {
  fetch(request: Request, env: object, ctx: object) {
    signals.set(ctx, request.signal);
    return handler.fetch(request, env, ctx);
  },
};

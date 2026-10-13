import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { httpServerHandler } from 'cloudflare:node';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { AppModule } from './app.module.ts';

const PORT = 8787;

// `@hono/node-server` replaces the global `Response` with a lighter
// one unless it is told not to, and this platform refuses an answer
// that is not one of its own: it answers 1101 before the application
// sees the request. Turning the replacement off keeps the platform's
// classes. It is a Workers-only concern — the lighter class is worth
// roughly a third of the CPU an answer costs — so the default stays.
const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
  trustProxy: false,
  rawBody: true,
  bodyLimit: 1024,
});

const app = await NestFactory.create<NestHonoApplication>(AppModule, adapter, {
  logger: ['error', 'warn'],
});

app.enableCors({
  origin: ['https://example.com'],
  credentials: true,
});

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

/**
 * The signal of every request this Worker is answering, filed
 * under the execution context its `fetch` was given.
 *
 * A Worker says a client walked away by aborting that signal,
 * and this platform says it no other way: nothing here closes
 * a connection, and a stream is never cancelled. The signal
 * belongs to the platform's request, which the application
 * never sees, so it is filed under the one object both sides
 * hold — see `contextOf` for the reading side.
 */
const signals = new WeakMap<object, AbortSignal>();

/**
 * The execution context the platform gave this request, read
 * back off the request the application was handed.
 *
 * `cloudflare:node` builds that request, and the handle it
 * leaves on it is where the platform's own request context
 * survives. Nothing documents the handle, so it is read
 * defensively: a runtime that stops leaving one leaves the
 * application where it was, which is with no signal at all.
 *
 * The parameter is `object` rather than an `IncomingMessage`:
 * the binding is whatever object the runtime attached, and this
 * Worker only reads a handle off it.
 */
function contextOf(incoming: object): object | undefined {
  const held: unknown = Reflect.get(incoming, 'cloudflare');
  if (typeof held !== 'object' || held === null) {
    return undefined;
  }
  if (!('ctx' in held)) {
    return undefined;
  }
  const { ctx } = held;
  return typeof ctx === 'object' && ctx !== null ? ctx : undefined;
}

adapter.getHono().get('/v1/debug-env', (context) => {
  const { incoming } = context.env;
  return context.json({
    hasIncoming: incoming !== undefined,
    hasSocket: incoming?.socket !== undefined,
    remoteAddress: incoming?.socket?.remoteAddress ?? null,
  });
});

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

const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Ailura NestJS + Hono (Cloudflare node)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/v1/docs-json', (context) => context.json(document));

app.use(
  '/v1/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Cloudflare node)',
  }),
);

await app.listen(PORT);

const handler = httpServerHandler({ port: PORT });

export default {
  // The request's signal is filed under the execution context
  // before the platform's own handler runs, so the middleware
  // above finds it when the application reads the binding.
  fetch(request: Request, env: object, ctx: object) {
    signals.set(ctx, request.signal);
    // `ExportedHandler.fetch` is optional in the type and always
    // present on what `httpServerHandler` returns.
    return handler.fetch!(request, env, ctx);
  },
};

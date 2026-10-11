import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { httpServerHandler } from 'cloudflare:node';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/servers/node';
import { AppModule } from './app.module.ts';

// `cloudflare:node` provides an in-process `node:http` server, so
// the Worker serves through the Node transport. The lighter global
// `Response` is refused by the platform (it answers 1101 before the
// application sees the request), so the replacement is turned off
// and the platform's own classes are kept.
const PORT = 8787;

const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
  trustProxy: true,
});

const app = await NestFactory.create<NestHonoApplication>(AppModule, adapter, {
  logger: ['error', 'warn'],
});

/**
 * The signal of every request this Worker is answering, filed
 * under the execution context its `fetch` was given.
 *
 * A Worker says a client walked away by aborting that signal, and
 * this platform says it no other way: nothing here closes a
 * connection, and a stream is never cancelled. The signal belongs
 * to the platform's request, which the application never sees, so
 * it is filed under the one object both sides hold — see
 * `contextOf` for the reading side.
 */
const signals = new WeakMap<object, AbortSignal>();

/**
 * The execution context the platform gave this request, read back
 * off the request the application was handed. `cloudflare:node`
 * builds that request, and the handle it leaves on it is where the
 * platform's own request context survives. Nothing documents the
 * handle, so it is read defensively.
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

adapter.getHono().get('/debug-env', (context) => {
  const { incoming } = context.env;
  return context.json({
    hasIncoming: incoming !== undefined,
    hasSocket: incoming !== undefined,
    remoteAddress: incoming?.socket?.remoteAddress ?? null,
  });
});

// An event stream ends when the request it was given ends, which on
// this platform is the only thing left to say the client is gone.
// The signal filed above is what knows.
adapter.getHono().use(async (context, next) => {
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

// The OpenAPI document, at `/docs-json`, and the Scalar API
// reference, at `/reference`. `wrangler.jsonc` defines
// `import.meta.url` so that `@nestjs/swagger` can build the
// document under `workerd`.
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Ailura NestJS + Hono (Cloudflare node)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/docs-json', (context) => context.json(document));

app.use(
  '/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Cloudflare node)',
  }),
);

await app.listen(PORT);

const handler = httpServerHandler({ port: PORT });

export default {
  fetch(request: Request, env: object, ctx: object) {
    signals.set(ctx, request.signal);
    return (
      handler as unknown as {
        fetch: (
          request: Request,
          env: object,
          ctx: object,
        ) => Response | Promise<Response>;
      }
    ).fetch(request, env, ctx);
  },
};

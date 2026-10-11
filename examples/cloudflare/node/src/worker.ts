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

const PORT = 8787;

const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
  trustProxy: true,
});

const app = await NestFactory.create<NestHonoApplication>(AppModule, adapter, {
  logger: ['error', 'warn'],
});

const signals = new WeakMap<object, AbortSignal>();

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

import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { httpServerHandler } from 'cloudflare:node';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { AppModule } from './app.module.ts';
import { registerDocs } from './docs.ts';

/** The port the Node server listens on. */
const PORT = 8787;

/** The adapter the Worker serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
  trustProxy: false,
  rawBody: true,
  bodyLimit: 1024,
});

/** The Nest application. */
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

/** The request signal filed under its execution context. */
const signals = new WeakMap<object, AbortSignal>();

/** The execution context the platform attached, if any. */
const contextOf = (incoming: object): object | undefined => {
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

registerDocs(app, adapter);

await app.listen(PORT);

/** The Node HTTP handler the Worker delegates to. */
const handler = httpServerHandler({ port: PORT });

/** Files the request signal and delegates to the Node handler. */
export default {
  fetch(request: Request, env: object, ctx: object) {
    signals.set(ctx, request.signal);
    return handler.fetch!(request, env, ctx);
  },
};

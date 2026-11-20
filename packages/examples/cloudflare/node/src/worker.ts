import 'reflect-metadata';
// Import before creating the app: it patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

import { httpServerHandler } from 'cloudflare:node';

import { createApp } from '@ailura/examples-shared';
import {
  ServerAdapter,
  registerBridge,
} from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { bridge as inertiaBridge } from '@ailura/nestjs-platform-hono-inertia';
import { AppModule } from './app.module.ts';

/** The port the Node server listens on. */
const PORT = 8787;

// A Worker resolves no bare specifier at run time, so the region cannot find the bridge.
registerBridge(inertiaBridge);

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
};

/** The Node handler the Worker delegates to, built on the first request. */
const start = async (): Promise<{
  fetch: (request: Request, env: object, ctx: object) => Promise<Response>;
}> => {
  /** The adapter the Worker serves through. */
  const adapter = new ServerAdapter({
    transport: nodeServer({ overrideGlobalObjects: false }),
    trustProxy: false,
    rawBody: true,
    bodyLimit: 1024,
  });

  /** The Nest application. */
  const app = await createApp(adapter, AppModule);

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
      const signal = holding === undefined ? undefined : signals.get(holding);
      signal?.addEventListener('abort', () => {
        incoming.emit('close');
      });
    }
    await next();
  });

  await app.listen(PORT);

  return httpServerHandler({ port: PORT }) as {
    fetch: (request: Request, env: object, ctx: object) => Promise<Response>;
  };
};

// Built inside the handler: a Worker forbids random values in the global scope, and the Inertia
// file renderer draws its placeholders with `crypto.randomBytes`.
let serving: Promise<{
  fetch: (request: Request, env: object, ctx: object) => Promise<Response>;
}> | undefined;

/** Files the request signal and delegates to the Node handler. */
export default {
  fetch(request: Request, env: object, ctx: object): Promise<Response> {
    signals.set(ctx, request.signal);
    serving ??= start();
    return serving.then((handler) => handler.fetch(request, env, ctx));
  },
};

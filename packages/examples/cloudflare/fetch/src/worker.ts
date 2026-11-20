import 'reflect-metadata';
// Import before creating the app: it patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

import { loadPackageSync } from '@nestjs/common/utils/load-package.util.js';
import { WsAdapter } from '@nestjs/platform-ws';
import { upgradeWebSocket } from '@hono/cloudflare-workers';

import { createApp } from '@ailura/examples-shared';
import {
  ServerAdapter,
  registerBridge,
} from '@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
  webSocketFromHost,
} from '@ailura/nestjs-hono-adapter/fetch';
import { bridge as inertiaBridge } from '@ailura/nestjs-platform-hono-inertia';
import { bridge as wsBridge } from '@ailura/nestjs-platform-hono-ws';
import { AppModule } from './app.module.ts';

// The `ws` package cannot be loaded in a Worker, and Nest's own `WsAdapter` reads it in its
// constructor; the bridge never builds a `ws.Server`, so an empty one answers the load.
loadPackageSync('ws', 'WsAdapter', () => ({}));

// A Worker resolves no bare specifier at run time, so the region cannot find the bridges.
registerBridge(inertiaBridge);
registerBridge(wsBridge);

/** The fetch handler the Worker serves through, built on the first request. */
const start = async (): Promise<ReturnType<typeof fetchHandler>> => {
  /** The adapter the Worker serves through. */
  const adapter = new ServerAdapter({
    transport: fetchServer({
      // The upgrade a Worker answers with: the platform's own helper, handed to the transport.
      upgradeWebSocket: webSocketFromHost(upgradeWebSocket),
    }),
    trustProxy: false,
    rawBody: true,
    bodyLimit: 1024,
  });

  /** The Nest application. */
  const app = await createApp(adapter, AppModule);

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.init();

  return fetchHandler(adapter.getHono(), {
    clientAddress: (request) =>
      request.headers.get('cf-connecting-ip') ?? undefined,
  });
};

// Built inside the handler: a Worker forbids random values in the global scope, and the Inertia
// file renderer draws its placeholders with `crypto.randomBytes`.
let serving: Promise<ReturnType<typeof fetchHandler>> | undefined;

/** Serves the Hono application over the Worker fetch handler. */
export default {
  fetch(request: Request): Promise<Response> {
    serving ??= start();
    return serving.then((serve) => serve(request));
  },
};

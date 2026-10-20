import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { loadPackageSync } from '@nestjs/common/utils/load-package.util.js';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { upgradeWebSocket } from '@hono/cloudflare-workers';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  ServerAdapter,
  registerBridge,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
  webSocketFromHost,
} from '@ailura/nestjs-hono-adapter/fetch';
import { bridge } from '@ailura/nestjs-platform-hono-ws';
import { AppModule } from './app.module.ts';

// The `ws` package cannot be loaded in a Worker, and Nest's own `WsAdapter` reads it in its
// constructor; the bridge never builds a `ws.Server`, so an empty one answers the load.
loadPackageSync('ws', 'WsAdapter', () => ({}));

// A Worker resolves no bare specifier at run time, so the region cannot find the bridge.
registerBridge(bridge);

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
const app = await NestFactory.create<NestHonoApplication>(
  AppModule,
  adapter,
  { logger: ['error', 'warn'] },
);

app.enableCors({
  origin: ['https://example.com'],
  credentials: true,
});

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

/** The OpenAPI document the docs routes serve. */
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Ailura NestJS + Hono (Cloudflare fetch)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/v1/docs-json', (context) => context.json(document));

app.use(
  '/v1/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Cloudflare fetch)',
  }),
);

app.useWebSocketAdapter(new WsAdapter(app));

await app.init();

/** Serves the Hono application over the Worker fetch handler. */
export default {
  fetch: fetchHandler(adapter.getHono(), {
    clientAddress: (request) =>
      request.headers.get('cf-connecting-ip') ?? undefined,
  }),
};

import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  ServerAdapter,
  type NestHonoApplication,
} from 'npm:@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
} from 'npm:@ailura/nestjs-hono-adapter/fetch';
import { AppModule } from './app.module.ts';

/** The port the example serves on. */
const PORT = Number(Deno.env.get('PORT') ?? '8787');

/** The adapter the example serves through. */
const adapter = new ServerAdapter({
  transport: fetchServer(),
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
    .setTitle('Ailura NestJS + Hono (Deno fetch)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/v1/docs-json', (context) => context.json(document));

app.use(
  '/v1/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Deno fetch)',
  }),
);

await app.init();

/** Serves the Hono application over Deno's fetch handler. */
Deno.serve({ port: PORT }, (request, info) => {
  const clientAddress = info.remoteAddr.hostname;
  return fetchHandler(adapter.getHono(), {
    clientAddress: () => clientAddress,
  })(request);
});

console.log(`listening on ${PORT}`);

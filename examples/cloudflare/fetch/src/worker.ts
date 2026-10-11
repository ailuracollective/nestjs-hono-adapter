import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
} from '@ailura/nestjs-hono-adapter/fetch';
import { AppModule } from './app.module.ts';

const adapter = new ServerAdapter({
  transport: fetchServer(),
  trustProxy: true,
});

const app = await NestFactory.create<NestHonoApplication>(
  AppModule,
  adapter,
  { logger: ['error', 'warn'] },
);

const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Ailura NestJS + Hono (Cloudflare fetch)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/docs-json', (context) => context.json(document));

app.use(
  '/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Cloudflare fetch)',
  }),
);

await app.init();

export default { fetch: fetchHandler(adapter.getHono()) };

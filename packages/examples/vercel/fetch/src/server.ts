import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
} from '@ailura/nestjs-hono-adapter/fetch';
import { AppModule } from './app.module.ts';
import { registerDocs } from './docs.ts';

/** The adapter the Vercel Function serves through. */
const adapter = new ServerAdapter({
  transport: fetchServer(),
  // Vercel overwrites x-forwarded-for on every request, so the one hop in
  // front of the application is trusted and the address it names is the client.
  trustProxy: true,
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

registerDocs(app, adapter);

await app.init();

/** Serves the Hono application through the fetch export Vercel detects. */
export default { fetch: fetchHandler(adapter.getHono()) };

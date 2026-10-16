import 'reflect-metadata';

import { getRequestListener } from '@hono/node-server';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { fetchHandler, fetchServer } from '@ailura/nestjs-hono-adapter/fetch';
import { AppModule } from './app.module.ts';
import { registerDocs } from './docs.ts';

/** The adapter the Cloud Function serves through. */
const adapter = new ServerAdapter({
  transport: fetchServer(),
  // Google's front end appends the client it saw to x-forwarded-for, so the last
  // entry is Google's and the first is whatever the client sent.
  trustProxy: 1,
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

/** The Node handler the Functions Framework invokes, over the fetch handler. */
const handler = getRequestListener(fetchHandler(adapter.getHono()));

export { handler };

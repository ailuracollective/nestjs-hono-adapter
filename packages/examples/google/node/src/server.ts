import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';
import { AppModule } from './app.module.ts';
import { registerDocs } from './docs.ts';

/** The port the revision listens on: Cloud Run names it in $PORT. */
const PORT = Number(process.env.PORT ?? 8080);

/** The adapter the Cloud Run revision serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer(),
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

await app.listen(PORT);

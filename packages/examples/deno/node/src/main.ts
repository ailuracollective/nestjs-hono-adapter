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

/** The port the example listens on. */
const PORT = Number(Deno.env.get('PORT') ?? '8787');

/** The adapter the example serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer(),
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

registerDocs(app, adapter);

await app.listen(PORT);

console.log(`listening on ${PORT}`);

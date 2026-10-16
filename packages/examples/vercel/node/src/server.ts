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

/** The port the server listens on: Vercel routes into it, it opens none. */
const PORT = Number(process.env.PORT ?? 3000);

/** The adapter the Vercel Function serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
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

/** Vercel captures the `http.Server` this opens — the listen call is what it detects — and re-listens on a port it proxies to, so the promise it never settles is left pending. */
void app.listen(PORT);

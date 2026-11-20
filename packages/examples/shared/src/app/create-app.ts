import { VersioningType } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type {
  NestHonoApplication,
  ServerAdapter,
} from '@ailura/nestjs-hono-adapter';

import { registerDocs } from './docs.ts';

/** Creates a demo application around a host's adapter, with CORS, versioning and docs. */
const createApp = async (
  adapter: ServerAdapter,
  module: Type<unknown>,
): Promise<NestHonoApplication> => {
  const app = await NestFactory.create<NestHonoApplication>(module, adapter, {
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

  return app;
};

export { createApp };

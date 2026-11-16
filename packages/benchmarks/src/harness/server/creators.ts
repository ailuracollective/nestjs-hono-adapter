import type { INestApplication, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { Target } from '#benchmarks/harness/config/index';

/** Boots a Nest application on the Hono Bun adapter. */
const bunApplication = async (module: Type<unknown>): Promise<INestApplication> => {
  const { ServerAdapter } = await import('@ailura/nestjs-hono-adapter');
  const { bunServer } = await import('@ailura/nestjs-hono-adapter/bun-server');
  return NestFactory.create(module, new ServerAdapter({ transport: bunServer() }));
};

/** Boots a Nest application on the Hono Node adapter. */
const nodeApplication = async (module: Type<unknown>): Promise<INestApplication> => {
  const { ServerAdapter } = await import('@ailura/nestjs-hono-adapter');
  const { nodeServer } = await import('@ailura/nestjs-hono-adapter/node-server');
  return NestFactory.create(module, new ServerAdapter({ transport: nodeServer() }));
};

/** Boots a Nest application on the official Express adapter. */
const expressApplication = async (module: Type<unknown>): Promise<INestApplication> => {
  const { ExpressAdapter } = await import('@nestjs/platform-express');
  const adapter = new ExpressAdapter();
  adapter.set('etag', false);
  adapter.set('x-powered-by', false);
  return NestFactory.create(module, adapter);
};

/** Boots a Nest application on the official Fastify adapter. */
const fastifyApplication = async (module: Type<unknown>): Promise<INestApplication> => {
  const { FastifyAdapter } = await import('@nestjs/platform-fastify');
  return NestFactory.create(module, new FastifyAdapter());
};

/** Mapping of target identifiers to their respective Nest app creators. */
const creators: Readonly<Record<Target, (module: Type<unknown>) => Promise<INestApplication>>> = {
  bun: bunApplication,
  express: expressApplication,
  fastify: fastifyApplication,
  node: nodeApplication,
};

export { creators };

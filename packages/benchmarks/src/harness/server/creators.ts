import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { BenchModule } from '#benchmarks/app/bench.module';
import type { Target } from '#benchmarks/harness/config/index';

/** Boots a Nest application backed by the Hono Bun adapter. */
const bunApplication = async (): Promise<INestApplication> => {
  const { ServerAdapter } =
    await import('@ailura/nestjs-hono-adapter');
  const { bunServer } =
    await import('@ailura/nestjs-hono-adapter/bun-server');
  return NestFactory.create(
    BenchModule,
    new ServerAdapter({ transport: bunServer() }),
  );
};

/** Boots a Nest application backed by the Hono Node adapter. */
const nodeApplication = async (): Promise<INestApplication> => {
  const { ServerAdapter } =
    await import('@ailura/nestjs-hono-adapter');
  const { nodeServer } =
    await import('@ailura/nestjs-hono-adapter/node-server');
  return NestFactory.create(
    BenchModule,
    new ServerAdapter({ transport: nodeServer() }),
  );
};

/**
 * Boots a Nest application backed by the official Express
 * adapter.
 */
const expressApplication =
  async (): Promise<INestApplication> => {
    const { ExpressAdapter } =
      await import('@nestjs/platform-express');
    return NestFactory.create(
      BenchModule,
      new ExpressAdapter(),
    );
  };

/**
 * Boots a Nest application backed by the official Fastify
 * adapter.
 */
const fastifyApplication =
  async (): Promise<INestApplication> => {
    const { FastifyAdapter } =
      await import('@nestjs/platform-fastify');
    return NestFactory.create(
      BenchModule,
      new FastifyAdapter(),
    );
  };

/**
 * Mapping of target identifiers to their respective Nest app
 * creators.
 */
const creators: Readonly<
  Record<Target, () => Promise<INestApplication>>
> = {
  bun: bunApplication,
  express: expressApplication,
  fastify: fastifyApplication,
  node: nodeApplication,
};

export { creators };

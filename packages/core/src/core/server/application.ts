import type { Server as NativeServer } from 'node:http';
import type { INestApplication } from '@nestjs/common';

import type { InjectRunner } from '#adapter/core/inject/types';
import type { Server } from '#adapter/core/ports/server';
import type { NestHono } from '#adapter/core/context';
import type { ServerAdapter } from './server-adapter.ts';

/**
 * The application `NestFactory.create()` hands back with this
 * adapter.
 */
interface NestHonoApplication extends INestApplication<
  Server & NativeServer
> {
  /** The adapter itself, rather than the shared contract. */
  getHttpAdapter: () => ServerAdapter;
  /** Answers a request inside the process, without a port. */
  inject: InjectRunner;
  /**
   * Adds one value to the data every template render is merged
   * onto.
   */
  setLocal: (key: string, value: unknown) => this;
  /** Sets one of the settings this adapter honours. */
  set: (name: string, value: unknown) => this;
  /** Sets a setting to `true`. */
  enable: (name: string) => this;
  /** Sets a setting to `false`. */
  disable: (name: string) => this;
}

declare module '@nestjs/common' {
  /** The Hono accessor this adapter adds to the shared contract. */
  interface HttpServer<TRequest, TResponse, ServerInstance> {
    /** The Hono application behind this adapter. */
    getHono: () => NestHono;
  }
}

export type { NestHonoApplication };

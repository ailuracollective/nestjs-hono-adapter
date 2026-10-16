import 'reflect-metadata';

import type { INestApplication, NestApplicationOptions, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { bunServer } from '@ailura/nestjs-hono-adapter/bun-server';

/** What a request made through the adapter answered. */
interface Answer {
  readonly body: unknown;
  readonly headers: Headers;
  readonly status: number;
  readonly text: string;
}

/** A Nest application listening on the adapter's Bun transport, reachable over HTTP. */
interface Probe {
  close: () => Promise<void>;
  request: (path: string, init?: RequestInit) => Promise<Answer>;
}

interface StartOptions {
  readonly application?: NestApplicationOptions;
  readonly configure?: (app: INestApplication) => void;
}

const ANY_PORT = 0;

const LOCALHOST = '127.0.0.1';

const parse = (text: string, contentType: string): unknown => {
  if (!contentType.includes('application/json') || text.length === 0) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const applicationOptions = (given: NestApplicationOptions | undefined): NestApplicationOptions => {
  const merged: NestApplicationOptions = { logger: false };
  if (given === undefined) return merged;
  Object.assign(merged, given);
  merged.logger = false;
  return merged;
};

const start = async (module: Type<unknown>, options: StartOptions = {}): Promise<Probe> => {
  const adapter = new ServerAdapter({ transport: bunServer() });
  const app = await NestFactory.create(module, adapter, applicationOptions(options.application));
  if (options.configure !== undefined) options.configure(app);
  await app.listen(ANY_PORT, LOCALHOST);
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError('the adapter is not listening on a port');
  }
  const origin = `http://${LOCALHOST}:${address.port}`;
  return {
    close: () => app.close(),
    request: async (path, init) => {
      const response = await fetch(`${origin}${path}`, init);
      const text = await response.text();
      const contentType = response.headers.get('content-type') ?? '';
      return {
        body: parse(text, contentType),
        headers: response.headers,
        status: response.status,
        text,
      };
    },
  };
};

/** Boots `module` on the adapter, hands the probe to `read`, and closes the application either way. */
const withApp = async <Value>(
  module: Type<unknown>,
  read: (probe: Probe) => Promise<Value>,
  options: StartOptions = {},
): Promise<Value> => {
  const probe = await start(module, options);
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

/**
 * Imports an optional package by a specifier the compiler cannot resolve, so a Nest major the
 * package does not support skips it instead of failing to load.
 */
const loadOptional = async <Shape>(specifier: string): Promise<Shape | undefined> => {
  try {
    return (await import(specifier)) as Shape;
  } catch {
    return undefined;
  }
};

export { loadOptional, withApp };
export type { Answer, Probe, StartOptions };

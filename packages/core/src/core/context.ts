import type { HttpBindings } from '@hono/node-server';
import type { Context, Hono } from 'hono';

import type { Bindings } from './ports/bindings.ts';

/** The environment a transport attaches to every request. */
interface NestEnv {
  Bindings: Bindings;
}

/** The environment `@hono/node-server` attaches. */
interface NodeEnv {
  Bindings: HttpBindings;
}

/** The Hono application, typed with its bindings. */
type NestHono = Hono<NestEnv>;

/**
 * A Hono context, doubling as the response object Nest writes
 * to.
 */
type NestContext = Context<NestEnv>;

export type { NestEnv, NestContext, NestHono, NodeEnv };

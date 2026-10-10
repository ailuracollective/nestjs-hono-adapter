import type { HttpBindings } from '@hono/node-server';
import type { Context, Hono } from 'hono';

import type { Bindings } from './bindings.ts';

/**
 * Environment a transport attaches to every request: the
 * request carrier Nest's SSE path reads, the Node response
 * where the transport is `@hono/node-server`, and the native
 * server where the runtime has one. It is the adapter's own
 * binding: nothing here is required to be an
 * `IncomingMessage`.
 */
interface NestEnv {
  Bindings: Bindings;
}

/**
 * The environment `@hono/node-server` attaches, published under
 * the name this package knew it by before the transports split.
 * A handler annotated `Hono<NodeEnv>` keeps its `incoming` and
 * `outgoing` reads, which is the shape the default transport
 * still serves.
 */
interface NodeEnv {
  Bindings: HttpBindings;
}

/** The Hono application, typed with its bindings. */
type NestHono = Hono<NestEnv>;

/**
 * A Hono context, doubling as the response object Nest writes
 * to: keeping the transport in a Web `Response` is what makes
 * the adapter independent of the platform the request arrived
 * on.
 */
type NestContext = Context<NestEnv>;

export type { NestEnv, NestContext, NestHono, NodeEnv };

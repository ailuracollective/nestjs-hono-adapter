import type { HttpBindings } from '@hono/node-server';
import type { Context, Hono } from 'hono';

/**
 * Environment `@hono/node-server` attaches to every request. It
 * carries the raw Node request and response, which is how the
 * adapter reaches the client socket without depending on them
 * anywhere else.
 */
interface NodeEnv {
  Bindings: HttpBindings;
}

/** The Hono application, typed with its Node bindings. */
type NestHono = Hono<NodeEnv>;

/**
 * A Hono context. It doubles as the response object Nest writes
 * to: keeping the transport in a Web `Response` is what makes
 * the adapter independent of the platform the request arrived
 * on.
 */
type NestContext = Context<NodeEnv>;

export type { NestContext, NestHono, NodeEnv };

import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { toNestRequest } from '@ailura/nestjs-hono-adapter';

/** The request a context carries, under `req`. */
interface ResolverRequest {
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

/**
 * The base context a driver hands the deployment's own
 * `context` factory.
 */
type ResolverContext = Record<string, unknown> & {
  readonly req: ResolverRequest;
};

/**
 * The argument a deployment's `context` factory is called with.
 * `@as-integrations/express5` calls it exactly this way.
 */
interface ContextArgument {
  /** The request, in the shape an Express or Fastify one is. */
  readonly req: ResolverRequest;
  /** The object a handler answers through. */
  readonly res: NestContext;
}

/** The factory `GraphQLModule` accepts for `context`. */
type ContextFactory = (argument: ContextArgument) => unknown;

/** The names an Apollo deployment's `context` factory expects. */
const APOLLO_CONTEXT_KEY = 'c';

/** The names a Mercurius deployment's `context` factory expects. */
const FASTIFY_CONTEXT_KEY = 'ctx';

/**
 * Whether a value is the `context` factory a deployment named;
 * `GraphQLModule` accepts an object too, and that is not one.
 */
const isContextFactory = (
  value: unknown,
): value is ContextFactory => typeof value === 'function';

/** The headers of one request, as a plain object. */
const headersOf = (
  context: NestContext,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of context.req.raw.headers) {
    headers[name] = value;
  }
  return headers;
};

/** The request, as a resolver's base context carries it. */
const resolverRequest = (
  context: NestContext,
): ResolverRequest => ({
  headers: headersOf(context),
  method: context.req.method,
  url: context.req.url,
});

/**
 * The request a deployment's factory is handed: the adapter's
 * own request object.
 */
const requestOf = (context: NestContext): ResolverRequest =>
  toNestRequest(context, { trustProxy: false });

export {
  APOLLO_CONTEXT_KEY,
  FASTIFY_CONTEXT_KEY,
  headersOf,
  isContextFactory,
  requestOf,
  resolverRequest,
};
export type {
  ContextArgument,
  ContextFactory,
  ResolverContext,
  ResolverRequest,
};

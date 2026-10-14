import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { toNestRequest } from '@ailura/nestjs-hono-adapter';

interface ResolverRequest {
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

type ResolverContext = Record<string, unknown> & {
  readonly req: ResolverRequest;
};

/**
 * The argument a deployment's `context` factory is called with. `@as-integrations/express5` calls
 * it exactly this way.
 */
interface ContextArgument {
  readonly req: ResolverRequest;
  readonly res: NestContext;
}

type ContextFactory = (argument: ContextArgument) => unknown;

const APOLLO_CONTEXT_KEY = 'c';

const FASTIFY_CONTEXT_KEY = 'ctx';

/**
 * Whether a value is the `context` factory a deployment named; `GraphQLModule` accepts an object
 * too, and that is not one.
 */
const isContextFactory = (value: unknown): value is ContextFactory => typeof value === 'function';

const headersOf = (context: NestContext): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of context.req.raw.headers) {
    headers[name] = value;
  }
  return headers;
};

const resolverRequest = (context: NestContext): ResolverRequest => ({
  headers: headersOf(context),
  method: context.req.method,
  url: context.req.url,
});

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
export type { ContextArgument, ContextFactory, ResolverContext, ResolverRequest };

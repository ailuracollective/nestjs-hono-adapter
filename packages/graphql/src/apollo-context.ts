import type { NestContext } from '@ailura/nestjs-hono-adapter';

import {
  APOLLO_CONTEXT_KEY,
  FASTIFY_CONTEXT_KEY,
  requestOf,
  resolverRequest,
} from './apollo-context-read.ts';
import type { ContextFactory, ResolverContext } from './apollo-context-read.ts';

const createResolverContext = (
  context: NestContext,
  factory: ContextFactory | undefined,
): Promise<unknown> => {
  if (factory !== undefined) {
    return Promise.resolve(factory({ req: requestOf(context), res: context }));
  }
  const base: ResolverContext = {
    [APOLLO_CONTEXT_KEY]: context,
    [FASTIFY_CONTEXT_KEY]: context,
    req: resolverRequest(context),
  };
  return Promise.resolve(base);
};

export { createResolverContext };

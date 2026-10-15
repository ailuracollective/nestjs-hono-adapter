import type { Next } from 'hono';

import type { NestContext } from '@ailura/nestjs-hono-adapter';

import { writeAnswer } from './apollo-answer.ts';
import type { ApolloAnswer } from './apollo-answer.ts';
import { readBody } from './apollo-body.ts';
import type { ContextFactory } from './apollo-context-read.ts';
import { createResolverContext } from './apollo-context.ts';
import { requestHeaders } from './apollo-write.ts';
import type { RequestHeaders } from './apollo-write.ts';

interface ApolloServer {
  readonly executeHTTPGraphQLRequest: (request: ApolloRequest) => Promise<ApolloAnswer>;
  start?: () => Promise<void>;
}

interface ApolloRequest {
  readonly context: () => Promise<unknown>;
  readonly httpGraphQLRequest: {
    readonly body: unknown;
    readonly headers: RequestHeaders;
    readonly method: string;
    readonly search: string;
  };
}

/**
 * The Hono handler for one Apollo server. Apollo's own integrations are an Express middleware and a
 * Fastify route
 */
const createApolloHandler =
  (
    server: ApolloServer,
    context: ContextFactory | undefined,
  ): ((honoContext: NestContext, next: Next) => Promise<Response | undefined>) =>
  async (honoContext, next): Promise<Response | undefined> => {
    const upgrade = honoContext.req.header('upgrade') ?? '';
    // An upgrade belongs to the subscriptions route, which sits after this one in the chain.
    if (upgrade.toLowerCase() === 'websocket') {
      // oxlint-disable-next-line node/callback-return -- next() answers with the upgrade, not a value.
      await next();
      return undefined;
    }
    const { req } = honoContext;
    const body = await readBody(honoContext);
    const answer = await server.executeHTTPGraphQLRequest({
      context: () => createResolverContext(honoContext, context),
      httpGraphQLRequest: {
        body,
        headers: requestHeaders(honoContext),
        method: req.method,
        search: new URL(req.url).search,
      },
    });
    return writeAnswer(honoContext, answer);
  };

export { createApolloHandler };
export type { ApolloRequest, ApolloServer };

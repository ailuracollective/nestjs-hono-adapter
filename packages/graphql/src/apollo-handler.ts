import type { NestContext } from '@ailura/nestjs-hono-adapter';

import { writeAnswer } from './apollo-answer.ts';
import type { ApolloAnswer } from './apollo-answer.ts';
import { readBody } from './apollo-body.ts';
import type { ContextFactory } from './apollo-context-read.ts';
import { createResolverContext } from './apollo-context.ts';
import { requestHeaders } from './apollo-write.ts';

/** The server members the handler calls. */
interface ApolloServer {
  /** Runs one GraphQL request and answers with its result. */
  readonly executeHTTPGraphQLRequest: (
    request: ApolloRequest,
  ) => Promise<ApolloAnswer>;
  /** Marks the server ready to answer. */
  start?: () => Promise<void>;
}

/** The one request Apollo is asked to execute. */
interface ApolloRequest {
  readonly context: () => Promise<unknown>;
  readonly httpGraphQLRequest: {
    readonly body: unknown;
    /**
     * A real `Headers`: the engine negotiates the answer's type
     * off it.
     */
    readonly headers: Headers;
    readonly method: string;
    readonly search: string;
  };
}

/**
 * The Hono handler for one Apollo server. Apollo's own
 * integrations are an Express middleware and a Fastify route
 */
const createApolloHandler =
  (
    server: ApolloServer,
    context: ContextFactory | undefined,
  ): ((honoContext: NestContext) => Promise<Response>) =>
  async (honoContext): Promise<Response> => {
    const { req } = honoContext;
    const body = await readBody(honoContext);
    const answer = await server.executeHTTPGraphQLRequest({
      context: () =>
        createResolverContext(honoContext, context),
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

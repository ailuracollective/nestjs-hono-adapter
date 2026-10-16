import type { NestHono } from '@ailura/nestjs-hono-adapter';

import { registerGraphQLRoute } from './route.ts';

import { isContextFactory } from './apollo-context-read.ts';
import { createApolloHandler } from './apollo-handler.ts';
import { buildApolloServer } from './apollo-server.ts';
import { DEFAULT_GRAPHQL_PATH, GRAPHQL_METHODS } from './peer-shapes.ts';
import type { ApolloDriverConfig, ApolloDriverShape } from './peer-shapes.ts';

interface OnHono {
  readonly driver: ApolloDriverShape;
  readonly hono: NestHono;
  readonly options: ApolloDriverConfig;
}

const registerApolloOnHono = async (target: OnHono): Promise<void> => {
  const { driver, hono, options } = target;
  const server = await buildApolloServer(options);
  if (server === undefined) return;
  const factory = isContextFactory(options.context) ? options.context : undefined;
  registerGraphQLRoute(hono, {
    handler: createApolloHandler(server, factory),
    methods: [...GRAPHQL_METHODS],
    path: options.path ?? DEFAULT_GRAPHQL_PATH,
  });
  driver.apolloServer = server;
};

export { registerApolloOnHono };
export type { OnHono };

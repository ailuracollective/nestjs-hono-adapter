import 'reflect-metadata';

import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';

interface ProbeRequest {
  readonly method?: string;
}

interface ProbedContext {
  readonly seen: string;
}

interface ResolverCarrier {
  readonly req?: ProbeRequest;
  readonly seen?: string;
}

const isContextArgument = (
  value: unknown,
): value is {
  readonly req: ProbeRequest;
  readonly res: unknown;
} => typeof value === 'object' && value !== null && 'req' in value && 'res' in value;

const isCarrier = (value: unknown): value is ResolverCarrier =>
  typeof value === 'object' && value !== null;

/**
 * The `context` factory a case hands `GraphQLModule`.
 *
 * Apollo's integrations call it as `context({ req, res })`, so this reads those two and reports
 * what it was handed. Whatever it returns is what the resolver receives, exactly as on Apollo's own
 * integrations.
 */
const probeContext = (argument: unknown): ProbedContext => {
  if (!isContextArgument(argument)) {
    return { seen: 'blind' };
  }
  const { req, res } = argument;
  const { method } = req;
  if (method === undefined || res === undefined) {
    return { seen: 'blind' };
  }
  return { seen: 'sighted' };
};

/**
 * The resolver. A GraphQL resolver's first argument is the root value and its context is the third,
 * so a fixture that reads the context has to say which one it means. It reports what the factory
 * said when there was one, and the base context's own `req` when there was not.
 */
const echo = (_source: unknown, _args: unknown, context: unknown): string => {
  if (!isCarrier(context)) {
    return 'blind';
  }
  const { req, seen } = context;
  if (seen !== undefined) return seen;
  if (req === undefined) return 'blind';
  return req.method ?? 'blind';
};

interface GraphQlOptions {
  readonly context?: (argument: unknown) => unknown;
  readonly path?: string;
}

/**
 * The module a case serves GraphQL from, naming the **stock** `ApolloDriver`. The bridge replaces
 * one branch of it, so a deployment that names the driver Nest publishes needs nothing of this
 * package.
 */
const graphQlModule = (options: GraphQlOptions = {}): Type<unknown> => {
  @Module({
    imports: [
      GraphQLModule.forRoot({
        context: options.context,
        driver: ApolloDriver,
        path: options.path,
        resolvers: { Query: { echo } },
        typeDefs: `type Query { echo: String }`,
      }),
    ],
  })
  class GraphQlFixture {}

  return GraphQlFixture;
};

export { graphQlModule, probeContext };
export type { GraphQlOptions };

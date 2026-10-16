import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '@ailura/nestjs-hono-adapter';
import { toHonoPath } from '@ailura/nestjs-hono-adapter';

/**
 * Answers one GraphQL request. The driver decides what the answer is; this seam only has to mount
 * it.
 */
type GraphQLHandler = MiddlewareHandler<NestEnv>;

interface GraphQLRoute {
  readonly handler: GraphQLHandler;
  readonly methods: string[];
  readonly path: string;
}

const registerGraphQLRoute = (hono: NestHono, route: GraphQLRoute): void => {
  hono.on(route.methods, toHonoPath(route.path), route.handler);
};

export { registerGraphQLRoute };
export type { GraphQLHandler, GraphQLRoute };

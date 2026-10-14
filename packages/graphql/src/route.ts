import type { MiddlewareHandler } from 'hono';

import type {
  NestEnv,
  NestHono,
} from '@ailura/nestjs-hono-adapter';
import { toHonoPath } from '@ailura/nestjs-hono-adapter';

/**
 * Answers one GraphQL request. The driver decides what the
 * answer is; this seam only has to mount it.
 */
type GraphQLHandler = MiddlewareHandler<NestEnv>;

/** One GraphQL endpoint, as a driver declares it. */
interface GraphQLRoute {
  /** The handler that answers one request. */
  readonly handler: GraphQLHandler;
  /** The methods the endpoint answers. */
  readonly methods: string[];
  /** The path the endpoint answers. */
  readonly path: string;
}

/**
 * Registers one GraphQL endpoint: all a driver needs from the
 * adapter.
 */
const registerGraphQLRoute = (
  hono: NestHono,
  route: GraphQLRoute,
): void => {
  hono.on(route.methods, toHonoPath(route.path), route.handler);
};

export { registerGraphQLRoute };
export type { GraphQLHandler, GraphQLRoute };

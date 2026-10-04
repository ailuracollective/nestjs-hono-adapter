import type { AbstractHttpAdapter } from '@nestjs/core';

import type { NestHandler } from './bridge.ts';

/**
 * A versioned route as the adapter contract declares it. It is
 * derived from the base class rather than written out, because
 * Nest types the value such a route resolves to as `Function`.
 */
type VersionedRoute = ReturnType<
  AbstractHttpAdapter['applyVersionFilter']
>;

/**
 * Narrows a version filter to the type the contract asks for.
 *
 * The contract says a versioned route resolves to a `Function`,
 * which no handler answering with a response can satisfy. The
 * router only ever calls the function it is handed, so the two
 * differ in the type alone. Confining the assertion here keeps
 * the rest of the adapter free of them, and `no-unsafe-type-
 * assertion` is disabled for this file alone.
 */
function asVersionedRoute(
  handler: NestHandler,
): VersionedRoute {
  return handler as VersionedRoute;
}

export { asVersionedRoute, type VersionedRoute };

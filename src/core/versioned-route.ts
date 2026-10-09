import type { AbstractHttpAdapter } from '@nestjs/core';

import type { NestHandler } from './request.ts';

/**
 * A versioned route as the adapter contract declares it,
 * derived from the base class because Nest types the value it
 * resolves to as `Function`.
 */
type VersionedRoute = ReturnType<
  AbstractHttpAdapter['applyVersionFilter']
>;

/**
 * Narrows a version filter to the type the contract asks for.
 * That contract says a versioned route resolves to a
 * `Function`, which no handler answering with a response can
 * satisfy; the router only ever calls the function it is
 * handed, so the two differ in the type alone. Confining the
 * assertion here keeps the rest of the adapter free of them,
 * which is why `no-unsafe-type-assertion` is disabled for this
 * file alone.
 */
function asVersionedRoute(
  handler: NestHandler,
): VersionedRoute {
  return handler as VersionedRoute;
}

export { asVersionedRoute, type VersionedRoute };

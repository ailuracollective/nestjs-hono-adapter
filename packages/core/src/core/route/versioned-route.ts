import type { AbstractHttpAdapter } from '@nestjs/core';

import type { NestHandler } from '#adapter/core/request/request';

/** A versioned route as the adapter contract declares it. */
type VersionedRoute = ReturnType<
  AbstractHttpAdapter['applyVersionFilter']
>;

/** Narrows a version filter to the type the contract asks for. */
const asVersionedRoute = (
  handler: NestHandler,
): VersionedRoute => handler as VersionedRoute;

export { asVersionedRoute, type VersionedRoute };

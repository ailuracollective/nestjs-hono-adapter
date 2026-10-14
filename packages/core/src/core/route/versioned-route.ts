import type { AbstractHttpAdapter } from '@nestjs/core';

import type { NestHandler } from '#adapter/core/request/request';

type VersionedRoute = ReturnType<AbstractHttpAdapter['applyVersionFilter']>;

const asVersionedRoute = (handler: NestHandler): VersionedRoute => handler as VersionedRoute;

export { asVersionedRoute, type VersionedRoute };

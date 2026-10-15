import { VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import type { VersioningOptions } from '@nestjs/common';

import type { NestHandler } from '#adapter/core/request/request';

import { isNeutral, matchesVersion } from './match.ts';
import type { VersionValue } from './match.ts';
import { readMediaTypeVersion } from './media-type.ts';

const createCustomFilter =
  (
    handler: NestHandler,
    version: VersionValue,
    extractor: (request: unknown) => string | string[],
  ): NestHandler =>
  (request, response, next) => {
    if (matchesVersion(version, extractor(request))) {
      return handler(request, response, next);
    }
    return next();
  };

const createMediaTypeFilter =
  (handler: NestHandler, version: VersionValue, key: string): NestHandler =>
  (request, response, next) => {
    const supplied = readMediaTypeVersion(request, key);
    if (supplied === undefined) {
      if (isNeutral(version)) {
        return handler(request, response, next);
      }
      return next();
    }
    if (matchesVersion(version, supplied)) {
      return handler(request, response, next);
    }
    return next();
  };

const createHeaderFilter =
  (handler: NestHandler, version: VersionValue, name: string): NestHandler =>
  (request, response, next) => {
    const supplied = request.get(name);
    if (supplied === undefined) {
      if (isNeutral(version)) {
        return handler(request, response, next);
      }
      return next();
    }
    if (matchesVersion(version, supplied)) {
      return handler(request, response, next);
    }
    return next();
  };

const createVersionFilter = (
  handler: NestHandler,
  version: VersionValue,
  options: VersioningOptions,
): NestHandler => {
  if (version === VERSION_NEUTRAL || options.type === VersioningType.URI) return handler;
  if (options.type === VersioningType.CUSTOM)
    return createCustomFilter(handler, version, options.extractor);
  if (options.type === VersioningType.MEDIA_TYPE)
    return createMediaTypeFilter(handler, version, options.key);
  return createHeaderFilter(handler, version, options.header);
};

export { createVersionFilter };

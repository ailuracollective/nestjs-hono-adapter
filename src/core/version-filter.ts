import {
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';
import type { VersioningOptions } from '@nestjs/common';
import type { NestHandler, NestRequest } from './bridge.ts';

/**
 * Mirrors VersionValue in version-options.interface, which
 *
 * @nestjs/common does not export: reading it from an internal
 * path would tie the package to a path Nest may move.
 */
type VersionValue =
  | string
  | typeof VERSION_NEUTRAL
  | (string | typeof VERSION_NEUTRAL)[];

function readHeader(
  request: NestRequest,
  name: string,
): string | undefined {
  return (
    request.headers[name] ?? request.headers[name.toLowerCase()]
  );
}

function isNeutral(version: VersionValue): boolean {
  return (
    Array.isArray(version) && version.includes(VERSION_NEUTRAL)
  );
}

/**
 * Normalises a version, or a list of them, into a list. The
 * neutral marker is a symbol, so the list type is widened to
 * match it.
 */
function toVersionList(
  value: string | VersionValue,
): (string | symbol)[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

function matchesVersion(
  version: VersionValue,
  supplied: string | string[] | undefined,
): boolean {
  if (supplied === undefined) {
    return false;
  }
  const suppliedVersions = toVersionList(supplied);
  const acceptedVersions = toVersionList(version);
  return acceptedVersions.some((accepted) =>
    suppliedVersions.includes(accepted),
  );
}

/**
 * Reads the version parameter out of the `Accept` header, which
 * looks like `application/json;v=1`.
 */
function readMediaTypeParameter(
  request: NestRequest,
): string | undefined {
  const accept = readHeader(request, 'accept');
  if (accept === undefined) {
    return undefined;
  }
  const [, parameter] = accept.split(';');
  return parameter;
}

/**
 * Answers every request whose version the extractor resolves to
 * one this route serves.
 */
function createCustomFilter(
  handler: NestHandler,
  version: VersionValue,
  extractor: (request: unknown) => string | string[],
): NestHandler {
  return (request, response, next) => {
    if (matchesVersion(version, extractor(request))) {
      return handler(request, response, next);
    }
    return next();
  };
}

function createMediaTypeFilter(
  handler: NestHandler,
  version: VersionValue,
  key: string,
): NestHandler {
  return (request, response, next) => {
    const parameter = readMediaTypeParameter(request);
    if (parameter === undefined) {
      if (isNeutral(version)) {
        return handler(request, response, next);
      }
      return next();
    }
    const [, supplied] = parameter.split(key);
    if (matchesVersion(version, supplied)) {
      return handler(request, response, next);
    }
    return next();
  };
}

function createHeaderFilter(
  handler: NestHandler,
  version: VersionValue,
  name: string,
): NestHandler {
  return (request, response, next) => {
    const supplied = readHeader(request, name.toLowerCase());
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
}

/**
 * Guards a route handler by request version for the versioning
 * styles the route path does not already resolve. The logic
 * mirrors Nest's own adapters, so a versioned route behaves the
 * same way on Hono.
 *
 * URI versioning is a plain path prefix and needs no filter. A
 * request that asks for an unknown version is passed on rather
 * than rejected, which is how Nest keeps an older version
 * serving the same route.
 */
function createVersionFilter(
  handler: NestHandler,
  version: VersionValue,
  options: VersioningOptions,
): NestHandler {
  if (
    version === VERSION_NEUTRAL ||
    options.type === VersioningType.URI
  ) {
    return handler;
  }
  if (options.type === VersioningType.CUSTOM) {
    return createCustomFilter(
      handler,
      version,
      options.extractor,
    );
  }
  if (options.type === VersioningType.MEDIA_TYPE) {
    return createMediaTypeFilter(handler, version, options.key);
  }
  return createHeaderFilter(handler, version, options.header);
}

export { createVersionFilter, type VersionValue };

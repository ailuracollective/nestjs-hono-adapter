import { matcherOf } from './peer-read.ts';
import type { Peers } from './peer-shapes.ts';

/** What `String.prototype.search` answers when nothing matched. */
const NO_MATCH = -1;

/**
 * Validates a global prefix the way `@nestjs/serve-static`
 * does.
 */
const validateGlobalPrefix = (prefix: string): boolean =>
  !/^\/?$/u.test(prefix);

/** Normalises what `exclude` accepted into one list of entries. */
const exclusionsOf = (exclude: unknown): unknown[] => {
  if (exclude instanceof RegExp) {
    return [exclude];
  }
  if (Array.isArray(exclude)) {
    return exclude;
  }
  if (exclude === undefined) {
    return [];
  }
  return [exclude];
};

/** Whether one entry excludes the path. */
const entryExcludes = (
  peers: Peers,
  pathname: string,
  entry: unknown,
): boolean => {
  if (entry instanceof RegExp) {
    return pathname.search(entry) !== NO_MATCH;
  }
  if (typeof entry !== 'string') {
    return false;
  }
  const matcher = matcherOf(peers, entry);
  if (matcher !== undefined) {
    return matcher.test(`${pathname}/`);
  }
  return pathname.startsWith(entry);
};

/**
 * Whether a request path is excluded by the option, through
 * `matcherOf()` so this module names no optional dependency.
 */
const isRouteExcluded = (
  peers: Peers,
  pathname: string,
  exclude: unknown,
): boolean =>
  exclusionsOf(exclude).some((entry) =>
    entryExcludes(peers, pathname, entry),
  );

export { isRouteExcluded, validateGlobalPrefix };

import { routePath } from 'hono/route';

import type { NestContext } from './context.ts';

/** The characters that end a named parameter in a pattern. */
const PARAMETER_END = /[?{]/u;

/** The index a search of a string did not find. */
const MISSING = -1;

const TRAILING_SLASH = /\/$/u;

/**
 * The pattern a request matched, with its named parameters
 * filled in by the values the route captured. One the route did
 * not capture is left as it was written, which reads as a
 * prefix the path cannot match, and the caller treats that as
 * no capture rather than a wrong one.
 */
function resolvedPrefixOf(
  pattern: string,
  params: Record<string, string>,
): string {
  const resolved = pattern.split('/').map((segment) => {
    if (!segment.startsWith(':')) {
      return segment;
    }
    const name = segment.slice(1).replace(PARAMETER_END, '');
    return params[name] ?? segment;
  });
  return resolved.join('/');
}

/**
 * Whether the path holds the prefix and, when the wildcard has
 * one, the suffix it stands between.
 */
function surrounds(
  path: string,
  prefix: string,
  suffix: string,
): boolean {
  if (!path.startsWith(prefix)) {
    return false;
  }
  return suffix === '' || path.endsWith(suffix);
}

/** What lies between a prefix and a suffix of the path. */
function captureBetween(
  path: string,
  prefix: string,
  suffix: string,
): string {
  if (suffix === '') {
    return path.slice(prefix.length);
  }
  return path.slice(prefix.length, path.length - suffix.length);
}

/**
 * The wildcard a route matched when it matched the bare prefix:
 * Hono routes `/tree` to `/tree/*`, so the wildcard matched
 * nothing rather than nothing matching, and that is empty
 * rather than absent.
 */
function emptyTailOf(
  path: string,
  prefix: string,
): string | undefined {
  if (path === prefix.replace(TRAILING_SLASH, '')) {
    return '';
  }
  return undefined;
}

/**
 * The text a wildcard stands for. The router matches the
 * wildcard without reporting what it stood for — it names the
 * pattern it matched, not the capture — so the capture is read
 * back out of the path: what lies between the part of the
 * pattern before the `*` and the part after it.
 */
function wildcardOf(
  context: NestContext,
  params: Record<string, string>,
): string | undefined {
  const pattern = routePath(context);
  const wildcard = pattern.indexOf('*');
  if (wildcard === MISSING) {
    return undefined;
  }
  const { path } = context.req;
  const prefix = resolvedPrefixOf(
    pattern.slice(0, wildcard),
    params,
  );
  const suffix = pattern.slice(wildcard + 1);
  if (!surrounds(path, prefix, suffix)) {
    return emptyTailOf(path, prefix);
  }
  return captureBetween(path, prefix, suffix);
}

/**
 * The params a route captured. The wildcard is read under the
 * key the router answers it by — `*`, the one Fastify uses —
 * and a path that matched none yields an empty bag.
 */
function paramsOf(
  context: NestContext,
): Record<string, string> {
  const params = context.req.param();
  const wildcard = wildcardOf(context, params);
  if (wildcard !== undefined) {
    params['*'] = decodeURIComponent(wildcard);
  }
  return params;
}

export { paramsOf };

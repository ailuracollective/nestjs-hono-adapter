import { routePath } from 'hono/route';

import type { NestContext } from '#adapter/core/context';

const PARAMETER_END = /[?{]/u;

const MISSING = -1;

const TRAILING_SLASH = /\/$/u;

const resolvedPrefixOf = (pattern: string, params: Record<string, string>): string => {
  const resolved = pattern.split('/').map((segment) => {
    if (!segment.startsWith(':')) {
      return segment;
    }
    const name = segment.slice(1).replace(PARAMETER_END, '');
    return params[name] ?? segment;
  });
  return resolved.join('/');
};

const surrounds = (path: string, prefix: string, suffix: string): boolean => {
  if (!path.startsWith(prefix)) {
    return false;
  }
  return suffix === '' || path.endsWith(suffix);
};

const captureBetween = (path: string, prefix: string, suffix: string): string => {
  if (suffix === '') return path.slice(prefix.length);
  return path.slice(prefix.length, path.length - suffix.length);
};

const emptyTailOf = (path: string, prefix: string): string | undefined => {
  if (path === prefix.replace(TRAILING_SLASH, '')) {
    return '';
  }
  return undefined;
};

const wildcardOf = (context: NestContext, params: Record<string, string>): string | undefined => {
  const pattern = routePath(context);
  const wildcard = pattern.indexOf('*');
  if (wildcard === MISSING) return undefined;
  const { path } = context.req;
  const prefix = resolvedPrefixOf(pattern.slice(0, wildcard), params);
  const suffix = pattern.slice(wildcard + 1);
  if (!surrounds(path, prefix, suffix)) {
    return emptyTailOf(path, prefix);
  }
  return captureBetween(path, prefix, suffix);
};

const paramsOf = (context: NestContext): Record<string, string> => {
  const params = context.req.param();
  const wildcard = wildcardOf(context, params);
  if (wildcard !== undefined) params['*'] = decodeURIComponent(wildcard);
  return params;
};

export { paramsOf };

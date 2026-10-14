import type { NestContext } from '@ailura/nestjs-hono-adapter';

/** A handler Hono runs, as the loader registers them. */
type Handler = (
  context: NestContext,
  next: () => Promise<void>,
) => Promise<unknown>;

/** The roots that mean "serve from the whole path". */
const WHOLE_PATH = new Set(['', '/']);

/** Normalises a root, dropping the shapes that serve everything. */
const normaliseRoot = (
  root: string | undefined,
): string | undefined =>
  root === undefined || WHOLE_PATH.has(root) ? undefined : root;

/** Strips the trailing slash a root may carry. */
const prefixOf = (root: string): string =>
  root.replace(/\/$/u, '');

/** Whether a pathname sits under a root. */
const underRoot = (
  pathname: string,
  root: string | undefined,
): boolean => {
  if (root === undefined) {
    return true;
  }
  const prefix = prefixOf(root);
  return (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
};

/** Strips the root from a path, keeping the root itself whole. */
const stripPrefix = (
  prefix: string,
  requestPath: string,
): string => {
  if (
    requestPath === prefix ||
    !requestPath.startsWith(prefix)
  ) {
    return requestPath;
  }
  const remainder = requestPath.slice(prefix.length);
  return remainder === '' ? '/' : remainder;
};

/**
 * Strips the root from the path the transport resolves, so a
 * directory under `/assets` is read from the client directory.
 */
const rewriteUnder = (
  root: string | undefined,
): undefined | ((requestPath: string) => string) => {
  if (root === undefined) {
    return undefined;
  }
  const prefix = prefixOf(root);
  return (requestPath: string): string =>
    stripPrefix(prefix, requestPath);
};

export { normaliseRoot, rewriteUnder, underRoot };
export type { Handler };

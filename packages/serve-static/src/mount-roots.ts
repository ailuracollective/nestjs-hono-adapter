import type { NestContext } from '@ailura/nestjs-hono-adapter';

type Handler = (context: NestContext, next: () => Promise<void>) => Promise<unknown>;

const WHOLE_PATH = new Set(['', '/']);

const normaliseRoot = (root: string | undefined): string | undefined =>
  root === undefined || WHOLE_PATH.has(root) ? undefined : root;

const prefixOf = (root: string): string => root.replace(/\/$/u, '');

const underRoot = (pathname: string, root: string | undefined): boolean => {
  if (root === undefined) return true;
  const prefix = prefixOf(root);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const stripPrefix = (prefix: string, requestPath: string): string => {
  if (requestPath === prefix || !requestPath.startsWith(prefix)) {
    return requestPath;
  }
  const remainder = requestPath.slice(prefix.length);
  return remainder === '' ? '/' : remainder;
};

/**
 * Strips the root from the path the transport resolves, so a directory under `/assets` is read from
 * the client directory.
 */
const rewriteUnder = (root: string | undefined): undefined | ((requestPath: string) => string) => {
  if (root === undefined) return undefined;
  const prefix = prefixOf(root);
  return (requestPath: string): string => stripPrefix(prefix, requestPath);
};

export { normaliseRoot, rewriteUnder, underRoot };
export type { Handler };

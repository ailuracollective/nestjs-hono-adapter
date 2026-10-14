import type { StaticOptions } from '@ailura/nestjs-hono-adapter';

import { validateGlobalPrefix } from './exclude.ts';
import { normaliseRoot, rewriteUnder } from './mount-roots.ts';
import type { ServeStaticConfig } from './options.ts';

/** Everything one registration resolved to. */
interface Resolved {
  /** The directory the files are read from. */
  readonly clientPath: string;
  /** The paths the option excludes. */
  readonly exclude: unknown;
  /** Whether a miss falls through to the next handler. */
  readonly fallthrough: boolean;
  /** The root the directory is mounted at, or none. */
  readonly serveRoot: string | undefined;
}

/**
 * The index file a directory answers with, when it answers with
 * one.
 */
const indexOf = (options: ServeStaticConfig): string => {
  const { serveStaticOptions } = options;
  if (serveStaticOptions === undefined) {
    return 'index.html';
  }
  const { index } = serveStaticOptions;
  return index === false || index === undefined
    ? 'index.html'
    : index;
};

/** Whether a miss falls through to the next handler. */
const fallthroughOf = (options: ServeStaticConfig): boolean => {
  const { serveStaticOptions } = options;
  if (serveStaticOptions === undefined) {
    return true;
  }
  return serveStaticOptions.fallthrough !== false;
};

/** The root a registration serves from, prefix included. */
const withPrefix = (
  options: ServeStaticConfig,
  globalPrefix: string | undefined,
): string | undefined => {
  if (
    globalPrefix === undefined ||
    options.useGlobalPrefix !== true ||
    !validateGlobalPrefix(globalPrefix)
  ) {
    return normaliseRoot(options.serveRoot);
  }
  return normaliseRoot(
    `/${globalPrefix}${options.serveRoot ?? ''}`,
  );
};

/** Resolves one registration against the deployment's prefix. */
const resolve = (
  options: ServeStaticConfig,
  defaultRoot: string,
  globalPrefix: string | undefined,
): Resolved => ({
  clientPath: options.rootPath ?? defaultRoot,
  exclude: options.exclude,
  fallthrough: fallthroughOf(options),
  serveRoot: withPrefix(options, globalPrefix),
});

/**
 * The options the transport serves a directory with. The
 * rewrite is left out entirely when there is none, because
 */
const staticOptionsOf = (
  options: ServeStaticConfig,
  resolved: Resolved,
): StaticOptions => {
  const rewrite = rewriteUnder(resolved.serveRoot);
  if (rewrite === undefined) {
    return {
      index: indexOf(options),
      root: resolved.clientPath,
    };
  }
  return {
    index: indexOf(options),
    rewriteRequestPath: rewrite,
    root: resolved.clientPath,
  };
};

export { resolve, staticOptionsOf };
export type { Resolved };

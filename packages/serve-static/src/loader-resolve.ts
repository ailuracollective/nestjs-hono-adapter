import type { StaticOptions } from '@ailura/nestjs-hono-adapter';

import { validateGlobalPrefix } from './exclude.ts';
import { normaliseRoot, rewriteUnder } from './mount-roots.ts';
import type { ServeStaticConfig } from './options.ts';

interface Resolved {
  readonly clientPath: string;
  readonly exclude: unknown;
  readonly fallthrough: boolean;
  readonly serveRoot: string | undefined;
}

const indexOf = (options: ServeStaticConfig): string => {
  const { serveStaticOptions } = options;
  if (serveStaticOptions === undefined) return 'index.html';
  const { index } = serveStaticOptions;
  return index === false || index === undefined ? 'index.html' : index;
};

const fallthroughOf = (options: ServeStaticConfig): boolean => {
  const { serveStaticOptions } = options;
  if (serveStaticOptions === undefined) return true;
  return serveStaticOptions.fallthrough !== false;
};

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
  return normaliseRoot(`/${globalPrefix}${options.serveRoot ?? ''}`);
};

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
 * The options the transport serves a directory with. The rewrite is left out entirely when there is
 * none, because
 */
const staticOptionsOf = (options: ServeStaticConfig, resolved: Resolved): StaticOptions => {
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

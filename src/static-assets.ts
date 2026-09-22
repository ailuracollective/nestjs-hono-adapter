import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';

import type { NestHono, NodeEnv } from './context.ts';

/**
 * The options Nest accepts for static assets. They are declared
 * here because Nest types the parameter as `any` on both the
 * application and the adapter, so nothing can be taken from a
 * signature.
 *
 * The options Hono's handler decides for itself are refused
 * rather than ignored, so a deployment finds out at startup
 * instead of from a response that quietly differs from the one
 * that was asked for.
 */
interface StaticAssetsOptions {
  readonly dotfiles?: string;
  readonly etag?: boolean;
  readonly extensions?: readonly string[];
  readonly fallthrough?: boolean;
  readonly immutable?: boolean;
  readonly index?: string | false;
  readonly maxAge?: number | string;
  readonly prefix?: string;
  readonly redirect?: boolean;
  readonly setHeaders?: unknown;
}

/** The index file a directory request is answered with. */
const DEFAULT_INDEX = 'index.html';

/** The header a cache lifetime is written with. */
const CACHE_CONTROL = 'cache-control';

/** How long each named unit lasts, in milliseconds. */
const MILLISECOND = 1;
const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;
const YEAR = 31_536_000_000;

/** The milliseconds one unit of a duration lasts. */
const UNIT_MS = new Map<string, number>([
  ['d', DAY],
  ['h', HOUR],
  ['m', MINUTE],
  ['ms', MILLISECOND],
  ['s', SECOND],
  ['w', WEEK],
  ['y', YEAR],
]);

/** A cache lifetime, spelled the way the `ms` package spells it. */
const DURATION =
  /^(?<amount>\d+(?:\.\d+)?)\s*(?<unit>ms|s|m|h|d|w|y)?$/u;

/** Names the option the Hono handler cannot honour. */
function unsupported(name: string): TypeError {
  return new TypeError(
    'The Hono adapter cannot honour the static asset ' +
      `option ${name}.`,
  );
}

/** The directories a call named, as a list. */
function toDirectories(
  path: string | readonly string[],
): readonly string[] {
  if (typeof path === 'string') {
    return [path];
  }

  return path;
}

/** Refuses the options that hook into another server. */
function assertNoHooks(options: StaticAssetsOptions): void {
  if (options.setHeaders !== undefined) {
    throw unsupported('setHeaders');
  }

  if (options.extensions !== undefined) {
    throw unsupported('extensions');
  }

  if (options.etag === false) {
    throw unsupported('etag: false');
  }
}

/** Refuses the options that ask for another serving mode. */
function assertNoOtherModes(
  options: StaticAssetsOptions,
): void {
  if (options.fallthrough === false) {
    throw unsupported('fallthrough: false');
  }

  if (options.dotfiles !== undefined) {
    throw unsupported('dotfiles');
  }

  if (options.index === false) {
    throw unsupported('index: false');
  }

  if (
    options.immutable === true &&
    options.maxAge === undefined
  ) {
    throw new TypeError(
      'The Hono adapter writes immutability with a maximum ' +
        'age, so maxAge has to be named with it.',
    );
  }
}

function assertSupported(options: StaticAssetsOptions): void {
  assertNoHooks(options);
  assertNoOtherModes(options);
}

/** The milliseconds a cache lifetime names. */
function toMilliseconds(maxAge: number | string): number {
  if (typeof maxAge === 'number') {
    return maxAge;
  }

  const match = DURATION.exec(maxAge.trim());
  if (match === null) {
    throw unsupported(`maxAge: ${maxAge}`);
  }

  const { amount, unit } = match.groups ?? {};
  const scale = UNIT_MS.get(unit ?? 'ms');
  if (scale === undefined) {
    throw unsupported(`maxAge: ${maxAge}`);
  }

  return Number(amount) * scale;
}

/** The header a served file is cached with. */
function cacheControl(options: StaticAssetsOptions): string {
  const milliseconds = toMilliseconds(options.maxAge ?? 0);
  const seconds = Math.floor(milliseconds / SECOND);
  const base = `public, max-age=${seconds}`;
  if (options.immutable === true) {
    return `${base}, immutable`;
  }

  return base;
}

/** Writes the cache lifetime a deployment asked for. */
function setCacheControl(
  response: Response,
  options: StaticAssetsOptions,
): void {
  if (options.maxAge === undefined) {
    return;
  }

  response.headers.set(CACHE_CONTROL, cacheControl(options));
}

/** The index file a directory request is answered with. */
function indexOf(options: StaticAssetsOptions): string {
  if (typeof options.index === 'string') {
    return options.index;
  }

  return DEFAULT_INDEX;
}

/** The request path without the prefix the assets hang under. */
function withoutPrefix(
  requestPath: string,
  prefix: string | undefined,
): string {
  if (prefix === undefined || prefix === '') {
    return requestPath;
  }

  return requestPath.slice(prefix.length);
}

/** The paths one mount answers on. */
function mountPaths(
  prefix: string | undefined,
): readonly string[] {
  if (prefix === undefined || prefix === '') {
    return ['/*'];
  }

  return [prefix, `${prefix}/*`];
}

/** The handler that serves one directory. */
function directoryHandler(
  directory: string,
  options: StaticAssetsOptions,
): MiddlewareHandler<NodeEnv> {
  const serve = serveStatic({
    index: indexOf(options),
    rewriteRequestPath: (path: string) =>
      withoutPrefix(path, options.prefix),
    root: directory,
  });

  return async (context, next) => {
    const found = await serve(context, next);
    if (found === undefined) {
      return found;
    }
    setCacheControl(found, options);

    return found;
  };
}

/**
 * Mounts the directories a deployment named, under the prefix
 * it asked for.
 *
 * A request that names no file in them travels on, which is
 * what Nest's own middleware does: the routes behind it answer,
 * and an answer the deployment asked for is written before
 * that.
 */
function mountStaticAssets(
  hono: NestHono,
  path: string | readonly string[],
  options: StaticAssetsOptions,
): void {
  assertSupported(options);
  const mounts = mountPaths(options.prefix);

  for (const directory of toDirectories(path)) {
    for (const mount of mounts) {
      hono.use(mount, directoryHandler(directory, options));
    }
  }
}

export { mountStaticAssets, toDirectories };
export type { StaticAssetsOptions };

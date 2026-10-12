import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '../core/context.ts';
import type {
  StaticOptions,
  Transport,
} from '../core/transport.ts';
import { toDirectories } from '../core/directories.ts';

/**
 * The options Nest accepts for static assets, declared here
 * because Nest types the parameter as `any` on both the
 * application and the adapter, so nothing can be taken from a
 * signature. The options Hono's handler decides for itself are
 * refused rather than ignored, so a deployment finds out at
 * startup instead of from a quietly different answer.
 */
interface StaticAssetsOptions {
  readonly dotfiles?: string;
  readonly etag?: boolean;
  readonly extensions?: readonly string[];
  readonly fallthrough?: boolean;
  readonly immutable?: boolean;
  readonly index?: string | false;
  readonly maxAge?: number | string;
  /**
   * The URL path the files are served under, with its leading
   * slash. It is stripped from the request before the file is
   * looked up, so `useStaticAssets('public', { prefix:
   * '/assets' })` serves `public/index.txt` at
   * `/assets/index.txt`.
   */
  readonly prefix?: string;
  readonly redirect?: boolean;
  /**
   * The directories to serve, which Fastify names here in its
   * first argument rather than Express's second one.
   */
  readonly root?: string | readonly string[];
  readonly setHeaders?: unknown;
}

/**
 * What a call names first: the directories, as Express does, or
 * the options, as Fastify does with the root inside them.
 */
type StaticAssetsTarget =
  | StaticAssetsOptions
  | string
  | readonly string[];

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

/**
 * Writes the cache lifetime a deployment asked for, marked
 * immutable when it asked for that too.
 */
function setCacheControl(
  response: Response,
  options: StaticAssetsOptions,
): void {
  if (options.maxAge === undefined) {
    return;
  }

  const milliseconds = toMilliseconds(options.maxAge);
  const seconds = Math.floor(milliseconds / SECOND);
  const base = `public, max-age=${seconds}`;
  let value = base;
  if (options.immutable === true) {
    value = `${base}, immutable`;
  }

  response.headers.set(CACHE_CONTROL, value);
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

/** What one directory is served from, as the transport reads it. */
interface StaticTarget {
  readonly hono: NestHono;
  readonly transport: Transport;
  /** What the call named first, in either transport's form. */
  readonly path?: StaticAssetsTarget;
  /**
   * What the call named second, which is Express's form. The
   * Fastify form carries its options in the first argument.
   */
  readonly options?: StaticAssetsOptions | undefined;
}

/**
 * Whether a call named its directories first, as Express does,
 * rather than the options Fastify names with the root inside.
 * Written as a guard because a readonly array is not narrowed
 * by the array test alone.
 */
function namesPathFirst(
  path: StaticAssetsTarget,
): path is string | readonly string[] {
  return typeof path === 'string' || Array.isArray(path);
}

/** The directories a call named, in either transport's form. */
function directoriesOf(
  target: StaticTarget,
): readonly string[] {
  const { path } = target;
  if (path === undefined) {
    return [];
  }
  if (namesPathFirst(path)) {
    return toDirectories(path);
  }
  if (path.root === undefined) {
    return [];
  }

  return toDirectories(path.root);
}

/** The options a call named, in either transport's form. */
function optionsOf(target: StaticTarget): StaticAssetsOptions {
  const { options, path } = target;
  if (options !== undefined) {
    return options;
  }
  if (path === undefined || namesPathFirst(path)) {
    return {};
  }

  return path;
}

/** Refuses a call that named nothing to serve. */
function assertDirectories(
  directories: readonly string[],
): void {
  if (directories.length === 0) {
    throw new TypeError(
      'useStaticAssets() named no directory: name them first, ' +
        'as Express does, or set root, as Fastify does.',
    );
  }
}

/** The paths one directory's assets answer. */
function mountsFor(
  options: StaticAssetsOptions,
): readonly string[] {
  const { prefix } = options;
  if (prefix === undefined || prefix === '') {
    // A deployment that named no prefix answers every path.
    return ['/*'];
  }

  return [prefix, `${prefix}/*`];
}

/** The transport options one directory is served with. */
function staticOptions(
  directory: string,
  options: StaticAssetsOptions,
): StaticOptions {
  const index = indexOf(options);
  const { prefix } = options;
  if (prefix === undefined) {
    return { index, root: directory };
  }
  return {
    index,
    rewriteRequestPath: (requestPath: string): string =>
      withoutPrefix(requestPath, prefix),
    root: directory,
  };
}

/** The handler that serves one directory. */
function directoryHandler(
  directory: string,
  transport: Transport,
  options: StaticAssetsOptions,
): MiddlewareHandler<NestEnv> {
  const serve = transport.serveStatic(
    staticOptions(directory, options),
  );

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
 * it asked for. A request naming no file in them travels on,
 * which is what Nest's own middleware does: the routes behind
 * it answer.
 */
function mountStaticAssets(target: StaticTarget): void {
  const { hono, transport } = target;
  const directories = directoriesOf(target);
  const options = optionsOf(target);
  assertNoHooks(options);
  assertNoOtherModes(options);
  assertDirectories(directories);

  for (const directory of directories) {
    for (const mount of mountsFor(options)) {
      hono.use(
        mount,
        directoryHandler(directory, transport, options),
      );
    }
  }
}

export { mountStaticAssets };
export type { StaticAssetsOptions, StaticAssetsTarget };

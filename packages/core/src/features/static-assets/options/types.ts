/** The options Nest accepts for static assets. */
interface StaticAssetsOptions {
  readonly dotfiles?: string;
  readonly etag?: boolean;
  readonly extensions?: readonly string[];
  readonly fallthrough?: boolean;
  readonly immutable?: boolean;
  readonly index?: string | false;
  readonly maxAge?: number | string;
  /** The URL path the files are served under. */
  readonly prefix?: string;
  readonly redirect?: boolean;
  /** The directories to serve. */
  readonly root?: string | readonly string[];
  readonly setHeaders?: unknown;
}

/** What a call names first: directories, or the options. */
type StaticAssetsTarget =
  | StaticAssetsOptions
  | string
  | readonly string[];

/** The index file a directory request is answered with. */
const DEFAULT_INDEX = 'index.html';

/** The header a cache lifetime is written with. */
const CACHE_CONTROL = 'cache-control';

/** One millisecond. */
const MILLISECOND = 1;
/** One second in milliseconds. */
const SECOND = 1000;
/** One minute in milliseconds. */
const MINUTE = 60_000;
/** One hour in milliseconds. */
const HOUR = 3_600_000;
/** One day in milliseconds. */
const DAY = 86_400_000;
/** One week in milliseconds. */
const WEEK = 604_800_000;
/** One year in milliseconds. */
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

export {
  DEFAULT_INDEX,
  CACHE_CONTROL,
  MILLISECOND,
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  WEEK,
  YEAR,
  UNIT_MS,
  DURATION,
};
export type { StaticAssetsOptions, StaticAssetsTarget };

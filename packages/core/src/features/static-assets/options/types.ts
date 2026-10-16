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
  readonly root?: string | readonly string[];
  readonly setHeaders?: unknown;
}

type StaticAssetsTarget = StaticAssetsOptions | string | readonly string[];

const DEFAULT_INDEX = 'index.html';

const CACHE_CONTROL = 'cache-control';

const MILLISECOND = 1;
const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;
const YEAR = 31_536_000_000;

const UNIT_MS = new Map<string, number>([
  ['d', DAY],
  ['h', HOUR],
  ['m', MINUTE],
  ['ms', MILLISECOND],
  ['s', SECOND],
  ['w', WEEK],
  ['y', YEAR],
]);

const DURATION = /^(?<amount>\d+(?:\.\d+)?)\s*(?<unit>ms|s|m|h|d|w|y)?$/u;

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

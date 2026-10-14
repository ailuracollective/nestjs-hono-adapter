import { unsupported } from './assert.ts';
import {
  DEFAULT_INDEX,
  CACHE_CONTROL,
  SECOND,
  UNIT_MS,
  DURATION,
} from './types.ts';
import type { StaticAssetsOptions } from './types.ts';

/** The milliseconds a cache lifetime names. */
const toMilliseconds = (maxAge: number | string): number => {
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
};

/** Writes the cache lifetime the deployment asked for. */
const setCacheControl = (
  response: Response,
  options: StaticAssetsOptions,
): void => {
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
};

/** The index file a directory request is answered with. */
const indexOf = (options: StaticAssetsOptions): string => {
  if (typeof options.index === 'string') {
    return options.index;
  }

  return DEFAULT_INDEX;
};

/** The request path without the prefix the assets hang under. */
const withoutPrefix = (
  requestPath: string,
  prefix: string | undefined,
): string => {
  if (prefix === undefined || prefix === '') {
    return requestPath;
  }

  return requestPath.slice(prefix.length);
};

export { indexOf, setCacheControl, withoutPrefix };

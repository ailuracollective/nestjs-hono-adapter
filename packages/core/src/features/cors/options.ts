import { promisify } from 'node:util';

import type { NestContext } from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type {
  NestRequest,
  TrustProxy,
} from '#adapter/core/request/request';
import type {
  CorsAnswer,
  CorsConfig,
  CorsOptions,
  CorsOptionsDelegate,
} from './types.ts';

/** The methods a browser may call. */
const ALLOWED_METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
];

/** The default seconds a browser may reuse a preflight answer. */
const MAX_AGE_SECONDS = 86_400;

/** The status a preflight is answered with. */
const PREFLIGHT_STATUS = 204;

/** An empty list of header names. */
const NO_HEADERS: readonly string[] = [];

/** Reads a string or an array as a readonly list. */
const asList = (
  value: string | readonly string[],
): readonly string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  return value;
};

/** Reads a header option as a list of names. */
const headerList = (
  value: string | readonly string[] | undefined,
  fallback: readonly string[],
): string[] => {
  if (value === undefined) {
    return [...fallback];
  }

  return asList(value)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
};

/** Calls an options delegate for one request. */
const askOptions = (
  delegate: CorsOptionsDelegate,
  request: NestRequest,
  answer: CorsAnswer,
): void => {
  delegate(request, answer);
};

/** The options delegate read as a promise. */
const askDecidedOptions = promisify(askOptions);

/** The CORS options that apply to one request. */
const resolveOptions = (
  config: CorsConfig,
  context: NestContext,
  trustProxy: TrustProxy,
): Promise<CorsOptions> => {
  if (typeof config !== 'function') {
    return Promise.resolve(config);
  }

  return askDecidedOptions(
    config,
    toNestRequest(context, { trustProxy }),
  );
};

export {
  ALLOWED_METHODS,
  MAX_AGE_SECONDS,
  NO_HEADERS,
  PREFLIGHT_STATUS,
  headerList,
  resolveOptions,
};

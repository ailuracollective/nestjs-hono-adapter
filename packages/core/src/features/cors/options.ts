import { promisify } from 'node:util';

import type { NestContext } from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestRequest, TrustProxy } from '#adapter/core/request/request';
import type { CorsAnswer, CorsConfig, CorsOptions, CorsOptionsDelegate } from './types.ts';

const ALLOWED_METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];

const MAX_AGE_SECONDS = 86400;

const PREFLIGHT_STATUS = 204;

const NO_HEADERS: readonly string[] = [];

const asList = (value: string | readonly string[]): readonly string[] => {
  if (typeof value === 'string') return [value];
  return value;
};

const headerList = (
  value: string | readonly string[] | undefined,
  fallback: readonly string[],
): string[] => {
  if (value === undefined) return [...fallback];

  return asList(value)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
};

const askOptions = (
  delegate: CorsOptionsDelegate,
  request: NestRequest,
  answer: CorsAnswer,
): void => {
  delegate(request, answer);
};

const askDecidedOptions = promisify(askOptions);

const resolveOptions = (
  config: CorsConfig,
  context: NestContext,
  trustProxy: TrustProxy,
): Promise<CorsOptions> => {
  if (typeof config !== 'function') return Promise.resolve(config);

  return askDecidedOptions(config, toNestRequest(context, { trustProxy }));
};

export {
  ALLOWED_METHODS,
  MAX_AGE_SECONDS,
  NO_HEADERS,
  PREFLIGHT_STATUS,
  headerList,
  resolveOptions,
};

import { promisify } from 'node:util';

import type {
  AllowedOrigins,
  OriginAnswer,
  OriginCallback,
} from '#adapter/features/cors/types';

import { allowedOrigin } from './rules.ts';

/** Calls an origin callback for one request. */
const askOrigin = (
  origin: OriginCallback,
  requestOrigin: string | undefined,
  answer: OriginAnswer,
): void => {
  origin(requestOrigin, answer);
};

/** The origin callback read as a promise. */
const askResolvedOrigin = promisify(askOrigin);

/** The origin rule that applies to one request. */
const resolveOrigin = (
  origin: AllowedOrigins | OriginCallback | undefined,
  requestOrigin: string | undefined,
): Promise<AllowedOrigins | undefined> => {
  if (typeof origin === 'function') {
    return askResolvedOrigin(origin, requestOrigin);
  }

  return Promise.resolve(origin ?? '*');
};

/** The origin rule the middleware is given. */
const middlewareOrigin = (
  named: AllowedOrigins | undefined,
): '*' | ((origin: string) => string | undefined) => {
  if (named === '*') {
    return '*';
  }
  return allowedOrigin(named);
};

export { middlewareOrigin, resolveOrigin };

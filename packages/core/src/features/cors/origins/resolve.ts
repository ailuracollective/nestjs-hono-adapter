import { promisify } from 'node:util';

import type { AllowedOrigins, OriginAnswer, OriginCallback } from '#adapter/features/cors/types';

import { allowedOrigin } from './rules.ts';

const askOrigin = (
  origin: OriginCallback,
  requestOrigin: string | undefined,
  answer: OriginAnswer,
): void => {
  origin(requestOrigin, answer);
};

const askResolvedOrigin = promisify(askOrigin);

const resolveOrigin = (
  origin: AllowedOrigins | OriginCallback | undefined,
  requestOrigin: string | undefined,
): Promise<AllowedOrigins | undefined> => {
  if (typeof origin === 'function') return askResolvedOrigin(origin, requestOrigin);

  return Promise.resolve(origin ?? '*');
};

// Hono compares a string or a list of them itself; only boolean, RegExp and mixed lists need a matcher.
const middlewareOrigin = (
  named: AllowedOrigins | undefined,
): string | string[] | ((origin: string) => string | undefined) => {
  if (typeof named === 'string') return named;
  if (Array.isArray(named) && named.every((rule) => typeof rule === 'string')) return named;
  return allowedOrigin(named);
};

export { middlewareOrigin, resolveOrigin };

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

const middlewareOrigin = (
  named: AllowedOrigins | undefined,
): '*' | ((origin: string) => string | undefined) => {
  if (named === '*') return '*';
  return allowedOrigin(named);
};

export { middlewareOrigin, resolveOrigin };

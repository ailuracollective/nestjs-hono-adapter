import { cors } from 'hono/cors';

import type { NestEnv } from '#adapter/core/context';
import {
  ALLOWED_METHODS,
  MAX_AGE_SECONDS,
  NO_HEADERS,
  PREFLIGHT_STATUS,
  headerList,
} from '#adapter/features/cors/options';
import {
  middlewareOrigin,
  staticOrigin,
} from '#adapter/features/cors/origins';
import type {
  AllowedOrigins,
  CorsOptions,
} from '#adapter/features/cors/types';
import type { MiddlewareHandler } from 'hono';

/** Translates CORS options into Hono's middleware. */
const corsMiddleware = (
  options: CorsOptions,
  resolved?: AllowedOrigins,
): MiddlewareHandler<NestEnv> => {
  const named = resolved ?? staticOrigin(options.origin);
  if (
    options.preflightContinue !== true &&
    options.optionsSuccessStatus !== undefined &&
    options.optionsSuccessStatus !== PREFLIGHT_STATUS
  ) {
    throw new TypeError(
      'The Hono adapter answers CORS preflight requests with ' +
        `${PREFLIGHT_STATUS}, so optionsSuccessStatus cannot ` +
        'name another status.',
    );
  }

  return cors({
    allowHeaders: headerList(
      options.allowedHeaders,
      NO_HEADERS,
    ),
    allowMethods: headerList(options.methods, ALLOWED_METHODS),
    credentials: options.credentials ?? false,
    exposeHeaders: headerList(
      options.exposedHeaders,
      NO_HEADERS,
    ),
    maxAge: options.maxAge ?? MAX_AGE_SECONDS,
    origin: middlewareOrigin(named),
  });
};

export { corsMiddleware };

import { cors } from 'hono/cors';

import type { NestEnv } from '#adapter/core/context';
import {
  ALLOWED_METHODS,
  MAX_AGE_SECONDS,
  NO_HEADERS,
  PREFLIGHT_STATUS,
  headerList,
} from '#adapter/features/cors/options';
import { middlewareOrigin, staticOrigin } from '#adapter/features/cors/origins';
import type { AllowedOrigins, CorsOptions } from '#adapter/features/cors/types';
import type { MiddlewareHandler } from 'hono';

// Hono's cors answers a preflight with 204; a deployment may name another status.
const withPreflightStatus =
  (middleware: MiddlewareHandler<NestEnv>, status: number): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    const answer = await middleware(context, next);
    if (answer === undefined) return answer;
    return new Response(undefined, { headers: answer.headers, status });
  };

const corsMiddleware = (
  options: CorsOptions,
  resolved?: AllowedOrigins,
): MiddlewareHandler<NestEnv> => {
  const named = resolved ?? staticOrigin(options.origin);
  const middleware = cors({
    allowHeaders: headerList(options.allowedHeaders, NO_HEADERS),
    allowMethods: headerList(options.methods, ALLOWED_METHODS),
    credentials: options.credentials ?? false,
    exposeHeaders: headerList(options.exposedHeaders, NO_HEADERS),
    maxAge: options.maxAge ?? MAX_AGE_SECONDS,
    origin: middlewareOrigin(named),
  });
  const status = options.optionsSuccessStatus;
  if (status === undefined || status === PREFLIGHT_STATUS) return middleware;
  return withPreflightStatus(middleware, status);
};

export { corsMiddleware };

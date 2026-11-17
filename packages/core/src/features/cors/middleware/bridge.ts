import type { MiddlewareHandler, Next } from 'hono';

import type { NestContext, NestEnv } from '#adapter/core/context';
import type { TrustProxy } from '#adapter/core/request/request';
import { resolveOptions } from '#adapter/features/cors/options';
import { resolveOrigin } from '#adapter/features/cors/origins';
import type { AllowedOrigins, CorsConfig, CorsOptions } from '#adapter/features/cors/types';

import { corsMiddleware } from './translate.ts';

const NOOP_NEXT = (): Promise<void> => Promise.resolve();

const isContinuedPreflight = (options: CorsOptions, context: NestContext): boolean =>
  options.preflightContinue === true && context.req.method === 'OPTIONS';

const forwardPreflight = async (
  context: NestContext,
  middleware: MiddlewareHandler<NestEnv>,
  next: Next,
): Promise<void> => {
  const answer = await middleware(context, NOOP_NEXT);
  if (answer !== undefined) {
    for (const [name, value] of answer.headers) {
      context.header(name, value);
    }
  }
  return next();
};

interface FittedCors {
  readonly allowed: AllowedOrigins;
  readonly middleware: MiddlewareHandler<NestEnv>;
  readonly options: CorsOptions;
}

const corsBridge = (
  handler: () => CorsConfig | undefined,
  trustProxy: () => TrustProxy,
): MiddlewareHandler<NestEnv> => {
  // Hono's cors middleware precomputes its header strings, so one built for a configuration
  // answers every request that repeats it.
  let cache: FittedCors | undefined = undefined;
  const middlewareFor = (
    options: CorsOptions,
    allowed: AllowedOrigins,
  ): MiddlewareHandler<NestEnv> => {
    if (cache !== undefined) {
      const repeated = cache.options === options && cache.allowed === allowed;
      if (repeated) return cache.middleware;
    }
    const middleware = corsMiddleware(options, allowed);
    cache = { allowed, middleware, options };
    return middleware;
  };

  return async (context, next) => {
    const config = handler();
    if (config === undefined) return next();

    const options =
      typeof config === 'function' ? await resolveOptions(config, context, trustProxy()) : config;
    const { origin } = options;
    const allowed =
      typeof origin === 'function'
        ? await resolveOrigin(origin, context.req.header('origin'))
        : (origin ?? '*');
    // The official cors package installs nothing for a falsy origin, and neither does this one.
    if (allowed === undefined || allowed === false || allowed === '') return next();
    const middleware = middlewareFor(options, allowed);
    if (isContinuedPreflight(options, context)) {
      return forwardPreflight(context, middleware, next);
    }

    return middleware(context, next);
  };
};

export { corsBridge };

import type { MiddlewareHandler } from 'hono';

import type { NestContext, NestEnv } from '#adapter/core/context';
import type { TrustProxy } from '#adapter/core/request/request';
import { resolveOptions } from '#adapter/features/cors/options';
import { resolveOrigin } from '#adapter/features/cors/origins';
import type { CorsConfig, CorsOptions } from '#adapter/features/cors/types';

import { corsMiddleware } from './translate.ts';

const NOOP_NEXT = (): Promise<void> => Promise.resolve();

const isContinuedPreflight = (options: CorsOptions, context: NestContext): boolean =>
  options.preflightContinue === true && context.req.method === 'OPTIONS';

const forwardPreflight = async (
  context: NestContext,
  middleware: MiddlewareHandler<NestEnv>,
): Promise<void> => {
  const answer = await middleware(context, NOOP_NEXT);
  if (answer === undefined) return;

  for (const [name, value] of answer.headers) {
    context.header(name, value);
  }
};

const corsBridge =
  (handler: () => CorsConfig | undefined, trustProxy: TrustProxy): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    const config = handler();
    if (config === undefined) return next();

    const options = await resolveOptions(config, context, trustProxy);
    const allowed = await resolveOrigin(options.origin, context.req.header('origin'));
    const middleware = corsMiddleware(options, allowed);
    if (isContinuedPreflight(options, context)) {
      await forwardPreflight(context, middleware);
      return next();
    }

    return middleware(context, next);
  };

export { corsBridge };

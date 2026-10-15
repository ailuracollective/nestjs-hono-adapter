import { BadRequestException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestHandler } from '#adapter/core/request/request';
import { finalizeOnResponse, whenResponseSettled } from '#adapter/core/response/response-helpers';

import {
  middlewareView,
  prepareRequest,
  requestOptions,
  settledAs,
  watchFailure,
} from './request.ts';
import { forwardFrom } from './forwarded.ts';
import type { Forwarded } from './forwarded.ts';
import { NOOP_NEXT } from './types.ts';
import type {
  BridgeOptions,
  ExceptionRunner,
  HonoRouteHandler,
  NestExceptionHandler,
  StreamInterceptor,
} from './types.ts';

interface RouteSpec {
  readonly handler: NestHandler;
  readonly interceptor: StreamInterceptor;
  readonly middleware: boolean;
  readonly options: BridgeOptions;
}

const settle = async (
  started: Promise<unknown>,
  forwarded: Forwarded,
  handled: Promise<unknown>,
): Promise<void> => {
  const outcome = await Promise.race([
    settledAs(handled, 'handled'),
    settledAs(started, 'streaming'),
  ]);
  if (outcome === 'streaming') {
    void watchFailure(handled);
  } else {
    await forwarded.settled();
  }
};

const routeRunner =
  (spec: RouteSpec): HonoRouteHandler =>
  async (context, next) => {
    const request = await prepareRequest(context, spec.options, spec.middleware);
    void request.params;
    const view = spec.middleware ? middlewareView(context) : undefined;
    const awaited = spec.middleware ? whenResponseSettled(context) : undefined;
    const started = spec.interceptor(context, () => spec.options.pendingStatus(context));
    const forwarded = forwardFrom(next, awaited);
    const handled = Promise.resolve(
      spec.handler(request, view === undefined ? context : view.proxy, forwarded.next),
    );
    await settle(started, forwarded, handled);
    // An `on-headers` listener attached by middleware (e.g. `cookie-session`) only runs when
    // `writeHead` is called; the chain has settled by now, so this is the moment.
    if (view !== undefined) view.commit();
    return context.res;
  };

const createRouteHandler = (
  handler: NestHandler,
  options: BridgeOptions,
  interceptor: StreamInterceptor,
): HonoRouteHandler => routeRunner({ handler, interceptor, middleware: false, options });

// Express hands a middleware mounted at a sub-path a request whose `url`/`path` start after the
// mount, and puts the mount on `baseUrl`; the mount is restored when the middleware calls `next`.
const withMount =
  (handler: NestHandler, base: string | undefined): NestHandler =>
  (request, response, next) => {
    if (base === undefined) return handler(request, response, next);
    request.mountAt(base);
    const mountedNext = (): unknown => {
      request.mountAt();
      return next();
    };
    return Promise.resolve(handler(request, response, mountedNext)).finally(() => {
      request.mountAt();
    });
  };

interface MiddlewareSpec {
  readonly base?: string | undefined;
  readonly handler: NestHandler;
}

const createMiddlewareHandler = (
  spec: MiddlewareSpec,
  options: BridgeOptions,
  interceptor: StreamInterceptor,
): HonoRouteHandler =>
  routeRunner({
    handler: withMount(spec.handler, spec.base),
    interceptor,
    middleware: true,
    options,
  });

const runNestHandler = async (
  handler: NestHandler,
  context: NestContext,
  options: BridgeOptions,
): Promise<Response> => {
  const request = await prepareRequest(context, options);
  await handler(request, context, NOOP_NEXT);
  return context.res;
};

const mapFrameworkError = (error: unknown): unknown => {
  if (error instanceof SyntaxError || error instanceof URIError)
    return new BadRequestException(error.message);
  return error;
};

const createExceptionRunner =
  (handler: NestExceptionHandler, options: BridgeOptions): ExceptionRunner =>
  async (error, context) => {
    const request = toNestRequest(context, requestOptions(options));
    finalizeOnResponse(context);
    await handler(error, request, context, NOOP_NEXT);
    return context.res;
  };

export {
  createExceptionRunner,
  createMiddlewareHandler,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
};

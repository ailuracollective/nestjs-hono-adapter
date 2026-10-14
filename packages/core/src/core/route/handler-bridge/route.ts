import { BadRequestException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestHandler } from '#adapter/core/request/request';
import { finalizeOnResponse } from '#adapter/core/response/response-helpers';

import {
  prepareRequest,
  requestOptions,
  settledAs,
  watchFailure,
} from './request.ts';
import { forwardFrom } from './forwarded.ts';
import { NOOP_NEXT } from './types.ts';
import type {
  BridgeOptions,
  ExceptionRunner,
  HonoRouteHandler,
  NestExceptionHandler,
  StreamInterceptor,
} from './types.ts';

/** Bridges one Nest handler to Hono. */
const createRouteHandler =
  (
    handler: NestHandler,
    options: BridgeOptions,
    interceptor: StreamInterceptor,
  ): HonoRouteHandler =>
  async (context, next) => {
    const request = await prepareRequest(context, options);
    void request.params;
    const started = interceptor(context, () =>
      options.pendingStatus(context),
    );
    const forwarded = forwardFrom(next);
    const handled = Promise.resolve(
      handler(request, context, forwarded.next),
    );
    const outcome = await Promise.race([
      settledAs(handled, 'handled'),
      settledAs(started, 'streaming'),
    ]);
    if (outcome === 'streaming') {
      void watchFailure(handled);
    } else {
      await forwarded.settled();
    }
    return context.res;
  };

/** Runs one Nest handler outside the Hono route pipeline. */
const runNestHandler = async (
  handler: NestHandler,
  context: NestContext,
  options: BridgeOptions,
): Promise<Response> => {
  const request = await prepareRequest(context, options);
  await handler(request, context, NOOP_NEXT);
  return context.res;
};

/** Maps a framework error to the exception filters expect. */
const mapFrameworkError = (error: unknown): unknown => {
  if (
    error instanceof SyntaxError ||
    error instanceof URIError
  ) {
    return new BadRequestException(error.message);
  }
  return error;
};

/** Builds the runner for the exception layer. */
const createExceptionRunner =
  (
    handler: NestExceptionHandler,
    options: BridgeOptions,
  ): ExceptionRunner =>
  async (error, context) => {
    const request = toNestRequest(
      context,
      requestOptions(options),
    );
    finalizeOnResponse(context);
    await handler(error, request, context, NOOP_NEXT);
    return context.res;
  };

export {
  createExceptionRunner,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
};

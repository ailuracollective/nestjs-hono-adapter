import type { NestContext } from '#adapter/core/context';
import { readBody } from '#adapter/core/request/body/index';
import type { ParsedBody } from '#adapter/core/request/body/index';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestRequest, RequestOptions } from '#adapter/core/request/request';
import { finalizeOnResponse } from '#adapter/core/response/response-helpers';
import { installSurface, middlewareResponse } from '#adapter/compat/express/surface-fit';

import { describe, logger } from './types.ts';
import type { BridgeOptions, Outcome } from './types.ts';

// The middleware view is created through this seam rather than named in `core` directly: the layer
// rule lets the request path reach exactly one file under `compat/`, and this is it.
const middlewareView = (context: NestContext): ReturnType<typeof middlewareResponse> =>
  middlewareResponse(context);

const requestOptions = (options: BridgeOptions): RequestOptions => ({
  trustProxy: options.trustProxy(),
});

const declaresMultipart = (context: NestContext): boolean =>
  (context.req.header('content-type') ?? '').toLowerCase().startsWith('multipart/form-data');

// A middleware may read the body itself (`graphql-upload` reads a multipart request as a stream).
// A body it already placed on the request is what the route reads, and a multipart mount is left
// the stream rather than having the adapter consume it first.
const carriesBody = (context: NestContext, request: NestRequest, middleware: boolean): boolean =>
  request.body !== undefined || (middleware && declaresMultipart(context));

const assignParsed = (request: NestRequest, parsed: ParsedBody): NestRequest => {
  request.body = parsed.body;
  request.files = parsed.files;
  request.rawBody = parsed.rawBody;
  return request;
};

const prepareRequest = async (
  context: NestContext,
  options: BridgeOptions,
  middleware = false,
): Promise<NestRequest> => {
  const request = toNestRequest(context, requestOptions(options));
  installSurface(context);
  finalizeOnResponse(context);
  if (!options.bodyParsingEnabled()) {
    return request;
  }
  if (carriesBody(context, request, middleware)) {
    return request;
  }
  const parsed = await readBody(context, {
    bodyLimit: options.bodyLimit(),
    rawBody: options.rawBody(),
    skipMultipart: options.multipart(),
  });
  return assignParsed(request, parsed);
};

const settledAs = async (promise: Promise<unknown>, outcome: Outcome): Promise<Outcome> => {
  await promise;
  return outcome;
};

const watchFailure = async (handled: Promise<unknown>): Promise<void> => {
  try {
    await handled;
  } catch (error) {
    logger.error(`A handler failed after its event stream started: ${describe(error)}`);
  }
};

export { middlewareView, prepareRequest, requestOptions, settledAs, watchFailure };

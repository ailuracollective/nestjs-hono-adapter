import type { NestContext } from '#adapter/core/context';
import { readBody } from '#adapter/core/request/body/index';
import { toNestRequest } from '#adapter/core/request/request';
import type {
  NestRequest,
  RequestOptions,
} from '#adapter/core/request/request';
import { finalizeOnResponse } from '#adapter/core/response/response-helpers';
import { installSurface } from '#adapter/compat/express/surface-fit';

import { describe, logger } from './types.ts';
import type { BridgeOptions, Outcome } from './types.ts';

/** The options Nest's request is built with. */
const requestOptions = (
  options: BridgeOptions,
): RequestOptions => ({ trustProxy: options.trustProxy() });

/** Builds the request Nest reads and parses its payload. */
const prepareRequest = async (
  context: NestContext,
  options: BridgeOptions,
): Promise<NestRequest> => {
  const request = toNestRequest(
    context,
    requestOptions(options),
  );
  installSurface(context);
  finalizeOnResponse(context);
  if (!options.bodyParsingEnabled()) {
    return request;
  }
  const parsed = await readBody(context, {
    bodyLimit: options.bodyLimit(),
    rawBody: options.rawBody(),
    skipMultipart: options.multipart(),
  });
  request.body = parsed.body;
  request.files = parsed.files;
  request.rawBody = parsed.rawBody;
  return request;
};

/** Waits for a promise and says which thing settled. */
const settledAs = async (
  promise: Promise<unknown>,
  outcome: Outcome,
): Promise<Outcome> => {
  await promise;
  return outcome;
};

/** Reports a failure that arrived after the stream was answered. */
const watchFailure = async (
  handled: Promise<unknown>,
): Promise<void> => {
  try {
    await handled;
  } catch (error) {
    logger.error(
      `A handler failed after its event stream started: ${describe(error)}`,
    );
  }
};

export {
  prepareRequest,
  requestOptions,
  settledAs,
  watchFailure,
};

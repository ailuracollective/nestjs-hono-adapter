import { Logger } from '@nestjs/common';
import type { Next } from 'hono';

import { readBody } from './body.ts';
import { toNestRequest } from './request.ts';
import type {
  NestHandler,
  NestRequest,
  NextHandler,
  RequestOptions,
} from './request.ts';
import type { NestContext } from './context.ts';
import { finalizeOnResponse } from './response-helpers.ts';

/**
 * Called when a handler runs outside a Hono pipeline, where
 * there is no next handler to continue to.
 */
const NOOP_NEXT: NextHandler = () => Promise.resolve();

/** Which of the two things a route handler races settled first. */
type Outcome = 'handled' | 'streaming';

/** Says a handler failed after the stream it started was sent. */
const logger = new Logger('SseRoute');

/** The message of a failure, whatever shape it was thrown in. */
function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** The handler Hono runs for a route Nest registered. */
type HonoRouteHandler = (
  context: NestContext,
  next: Next,
) => Promise<Response>;

/**
 * Opens a stream on the response Nest reads, and says when it
 * started. This is all the bridge asks of one: `core` names the
 * shape, and the capability that mounts an event stream
 * satisfies it structurally rather than being imported for it.
 */
type StreamInterceptor = (
  context: NestContext,
  status: () => number | undefined,
) => Promise<unknown>;

/**
 * The handler Nest installs as its global exception layer. It
 * takes the exception first, so it is not a route handler. The
 * arguments are spelled as a tuple because their order is fixed
 * by Nest rather than by this adapter.
 */
type NestExceptionHandler = (
  ...args: [unknown, NestRequest, NestContext, NextHandler]
) => unknown;

/** Runs the exception layer for one failed request. */
type ExceptionRunner = (
  error: unknown,
  context: NestContext,
) => Promise<Response>;

/**
 * Everything the bridge needs to know about the adapter that
 * built it. Each value is read per request rather than
 * captured, because a deployment configures the parsers and the
 * proxy behind the adapter after the routes exist.
 */
interface BridgeOptions {
  readonly bodyLimit: () => number | undefined;
  readonly bodyParsingEnabled: () => boolean;
  readonly pendingStatus: (
    context: NestContext,
  ) => number | undefined;
  readonly rawBody: () => boolean;
  readonly trustProxy: () => boolean;
}

function requestOptions(
  options: BridgeOptions,
): RequestOptions {
  return { trustProxy: options.trustProxy() };
}

/**
 * Builds the request Nest reads and the parser fills.
 *
 * Nest writes to the request bag, so the parsed payload is
 * copied into it here instead of being passed along separately.
 * A payload that cannot be parsed throws the exception Nest
 * raises for a failed parse, which is what lets the exception
 * layer answer it like any other failure.
 */
async function prepareRequest(
  context: NestContext,
  options: BridgeOptions,
): Promise<NestRequest> {
  const request = toNestRequest(
    context,
    requestOptions(options),
  );
  finalizeOnResponse(context);
  if (!options.bodyParsingEnabled()) {
    return request;
  }
  const parsed = await readBody(context, {
    bodyLimit: options.bodyLimit(),
    rawBody: options.rawBody(),
  });
  request.body = parsed.body;
  request.files = parsed.files;
  request.rawBody = parsed.rawBody;
  return request;
}

/**
 * Waits for a promise and says which of the two settled, so the
 * race below cannot confuse a handler that answered with
 * nothing and a stream that started.
 */
async function settledAs(
  promise: Promise<unknown>,
  outcome: Outcome,
): Promise<Outcome> {
  await promise;
  return outcome;
}

/**
 * Reports a failure that arrived after the stream it opened was
 * answered: the client already has its `200`, so there is
 * nothing left to send it to.
 */
async function watchFailure(
  handled: Promise<unknown>,
): Promise<void> {
  try {
    await handled;
  } catch (error) {
    logger.error(
      `A handler failed after its event stream started: ${describe(error)}`,
    );
  }
}

/**
 * Bridges one Nest handler to Hono: it builds the request Nest
 * reads, runs the handler and hands back the response the
 * adapter collected.
 *
 * An `@Sse()` route answers only when its observable completes,
 * which is exactly what a long-lived stream never does, so the
 * handler is raced against the stream it starts. The moment the
 * stream commits its headers the response goes out, and the
 * handler is left writing into it — with a late failure logged
 * instead of escaping.
 *
 * The interceptor is handed in rather than imported: which
 * streams exist is a deployment's business, and a composition
 * root decides it by passing the one to use.
 */
function createRouteHandler(
  handler: NestHandler,
  options: BridgeOptions,
  interceptor: StreamInterceptor,
): HonoRouteHandler {
  return async (context, next) => {
    const request = await prepareRequest(context, options);
    const started = interceptor(context, () =>
      options.pendingStatus(context),
    );
    const handled = Promise.resolve(
      handler(request, context, next),
    );
    const outcome = await Promise.race([
      settledAs(handled, 'handled'),
      settledAs(started, 'streaming'),
    ]);
    if (outcome === 'streaming') {
      void watchFailure(handled);
    }
    return context.res;
  };
}

async function runNestHandler(
  handler: NestHandler,
  context: NestContext,
  options: BridgeOptions,
): Promise<Response> {
  const request = await prepareRequest(context, options);
  await handler(request, context, NOOP_NEXT);
  return context.res;
}

/**
 * Builds the runner for the exception layer. The payload is not
 * read again here: the failure may well be that reading it
 * failed, and a second attempt would replace the answer with a
 * failure of its own.
 */
function createExceptionRunner(
  handler: NestExceptionHandler,
  options: BridgeOptions,
): ExceptionRunner {
  return async (error, context) => {
    const request = toNestRequest(
      context,
      requestOptions(options),
    );
    finalizeOnResponse(context);
    await handler(error, request, context, NOOP_NEXT);
    return context.res;
  };
}

export {
  createExceptionRunner,
  createRouteHandler,
  runNestHandler,
};
export type {
  BridgeOptions,
  ExceptionRunner,
  NestExceptionHandler,
  StreamInterceptor,
};

import type { NestContext } from './context.ts';

/** The Hono helpers that write the answer for a request. */
const RESPONSE_HELPERS = [
  'body',
  'html',
  'json',
  'newResponse',
  'notFound',
  'redirect',
  'text',
] as const;

type ResponseHelper = (...args: never[]) => Response;

type ResponseHelperCarrier = Record<
  (typeof RESPONSE_HELPERS)[number],
  ResponseHelper
>;

/**
 * Wraps one helper so the response it built becomes the
 * response of the context. A wrapper is built per request
 * rather than once per application because Hono's helpers are
 * instance properties with no prototype to share them through;
 * dispatching through a map instead would trade seven
 * allocations for a lookup on a path only `@Res()` handlers
 * ever reach, and the closures cost about 230 nanoseconds
 * against a request costing over a hundred microseconds.
 */
function wrapHelper(
  carrier: ResponseHelperCarrier,
  name: (typeof RESPONSE_HELPERS)[number],
  context: NestContext,
): void {
  const helper = carrier[name];
  if (typeof helper !== 'function') {
    return;
  }
  carrier[name] = (...args: never[]): Response => {
    const response = helper.apply(context, args);
    context.res = response;
    return response;
  };
}

/**
 * Makes the Hono response helpers finalize the context. A
 * handler answering through `@Res()` calls one of these instead
 * of returning a value, and Nest then skips its own reply path;
 * Hono only finalizes a context when `res` is assigned, which
 * the helpers do not do, so the answer would be dropped and the
 * client would read an empty response.
 */
function finalizeOnResponse(context: NestContext): void {
  const carrier = context as unknown as ResponseHelperCarrier;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
}

export { finalizeOnResponse };

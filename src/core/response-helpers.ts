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
 * Wraps one helper so that the response it built becomes the
 * response of the context.
 *
 * A wrapper is built per request rather than once per
 * application because Hono's helpers are instance properties:
 * each context carries its own and there is no prototype to put
 * a shared one on. Sharing them would mean keeping the
 * originals somewhere and dispatching through a map on every
 * call, which trades seven allocations for a lookup on a path
 * that only `@Res()` handlers ever reach. Seven closures is
 * about 230 nanoseconds against a request that costs over a
 * hundred microseconds, so it is left as the straightforward
 * thing rather than made clever.
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
 * Makes the Hono response helpers finalize the context.
 *
 * A handler that answers through `@Res()` calls one of these
 * helpers instead of returning a value, and Nest then skips its
 * own reply path. Hono only finalizes a context when `res` is
 * assigned, and the helpers do not assign it, so the answer
 * would be dropped and the client would read an empty response.
 * Wrapping them on the instance — Hono's helpers are own
 * properties, not prototype methods — keeps the imperative
 * style working without taking the response away from Hono.
 */
function finalizeOnResponse(context: NestContext): void {
  const carrier = context as unknown as ResponseHelperCarrier;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
}

export { finalizeOnResponse };

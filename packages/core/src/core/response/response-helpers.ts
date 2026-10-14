import type { NestContext } from '#adapter/core/context';

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

/** One Hono helper that builds a response. */
type ResponseHelper = (...args: never[]) => Response;

/** The Hono helpers of a context, by name. */
type ResponseHelperCarrier = Record<
  (typeof RESPONSE_HELPERS)[number],
  ResponseHelper
>;

/** Wraps one helper so it becomes the context's response. */
const wrapHelper = (
  carrier: ResponseHelperCarrier,
  name: (typeof RESPONSE_HELPERS)[number],
  context: NestContext,
): void => {
  const helper = carrier[name];
  if (typeof helper !== 'function') {
    return;
  }
  carrier[name] = (...args: never[]): Response => {
    const response = helper.apply(context, args);
    context.res = response;
    return response;
  };
};

/** Makes the Hono response helpers finalize the context. */
const finalizeOnResponse = (context: NestContext): void => {
  const carrier = context as unknown as ResponseHelperCarrier;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
};

export { finalizeOnResponse };

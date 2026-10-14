import type { NestContext } from '#adapter/core/context';

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

type ResponseHelperCarrier = Record<(typeof RESPONSE_HELPERS)[number], ResponseHelper>;

const FITTED = Symbol('responseHelpers');

interface Fitted {
  [FITTED]?: true;
}

const wrapHelper = (
  carrier: ResponseHelperCarrier,
  name: (typeof RESPONSE_HELPERS)[number],
  context: NestContext,
): void => {
  const helper = carrier[name];
  if (typeof helper !== 'function') return;
  carrier[name] = (...args: never[]): Response => {
    const response = helper.apply(context, args);
    context.res = response;
    return response;
  };
};

/**
 * Hono builds these seven helpers as own properties of each context, so they can only be wrapped
 * per request; the mark is what keeps the error path from wrapping them a second time.
 */
const finalizeOnResponse = (context: NestContext): void => {
  const carrier = context as unknown as ResponseHelperCarrier & Fitted;
  if (carrier[FITTED] === true) return;
  carrier[FITTED] = true;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
};

export { finalizeOnResponse };

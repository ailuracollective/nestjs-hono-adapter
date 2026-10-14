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

const finalizeOnResponse = (context: NestContext): void => {
  const carrier = context as unknown as ResponseHelperCarrier;
  for (const name of RESPONSE_HELPERS) {
    wrapHelper(carrier, name, context);
  }
};

export { finalizeOnResponse };

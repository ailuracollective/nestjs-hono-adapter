import type { NestHandler } from '#adapter/core/request/request';

// oxlint-disable-next-line eslint/max-params -- the four parameters are the Express signature this bridge exists to recognise.
type ExpressErrorMiddleware = (err: unknown, req: unknown, res: unknown, next: unknown) => unknown;

const ERROR_ARITY = 4;

const isErrorMiddleware = (value: unknown): value is ExpressErrorMiddleware =>
  typeof value === 'function' && value.length === ERROR_ARITY;

// A four-parameter handler is Express's error middleware, not Hono's `(context, next)`. Nest's own
// middleware path wraps a module middleware down to three declared parameters before the adapter
// sees it, so the shape only survives `app.use(...)`; recognised where Nest mounts it, the handler
// gets the same request and fitted response view as any other middleware, plus the `err` argument.
const expressErrorMiddleware = (handler: NestHandler): NestHandler | undefined => {
  if (!isErrorMiddleware(handler)) {
    return undefined;
  }
  return (request, response, next) => handler(undefined, request, response, next);
};

export { expressErrorMiddleware };

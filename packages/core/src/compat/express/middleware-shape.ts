/** A middleware that expects Express' `(err, req, res, next)`. */
// oxlint-disable-next-line eslint/max-params -- the four parameters are the Express signature this bridge exists to recognise.
type ExpressErrorMiddleware = (
  err: unknown,
  req: Record<string, unknown>,
  res: Record<string, unknown>,
  next: (error?: unknown) => Promise<void>,
) => unknown;

/** The arity Express writes its error middleware at. */
const ERROR_ARITY = 4;

/** The count of arguments a path-only `use()` call carries. */
const ONLY_HANDLER = 1;

/** The index of the last argument, and the handler's own slot. */
const LAST = -1;

/** Whether a value is an Express-style error middleware. */
const isErrorMiddleware = (
  value: unknown,
): value is ExpressErrorMiddleware =>
  typeof value === 'function' && value.length === ERROR_ARITY;

/**
 * The `next` an Express error middleware is handed: it answers
 * the chain, and rethrows a failure.
 */
const continueChain =
  (next: () => Promise<void>) =>
  (error?: unknown): Promise<void> => {
    if (error !== undefined && error !== null) {
      // oxlint-disable-next-line typescript/only-throw-error -- an Express middleware reports whatever it was handed, and Nest's exception filter reads the value's class. Wrapping it would turn every HttpException a module passes to next() into a plain Error.
      throw error;
    }
    return next();
  };

export {
  ERROR_ARITY,
  LAST,
  ONLY_HANDLER,
  continueChain,
  isErrorMiddleware,
};
export type { ExpressErrorMiddleware };

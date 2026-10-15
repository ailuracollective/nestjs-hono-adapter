import type { Next } from 'hono';

interface Forwarded {
  readonly next: (error?: unknown) => Promise<void>;
  readonly settled: () => Promise<void>;
}

const reportsFailure = (value: unknown): boolean => value !== undefined && value !== null;

/**
 * Holds the continuation a middleware may hand to `next` open so the bridge can await it.
 *
 * An Express middleware reports a failure by calling `next(error)`; Hono's `next` takes no
 * argument, so dropping it here is what once turned a clear upstream error into a confusing one
 * further down the chain. The first failure is remembered and rethrown once the chain settles.
 *
 * `next` may also be deferred — `graphql-upload` calls it only once the body has been read — so
 * when the middleware has not called it yet the chain also waits on the response being assigned
 * (`whenResponseSettled`), which is how a middleware that answers without `next` finishes.
 */
const forwardFrom = (continuation: Next, responseSettled?: Promise<void>): Forwarded => {
  let started: Promise<void> | undefined = undefined;
  let failure: unknown = undefined;
  const called = Promise.withResolvers<undefined>();
  return {
    next: (error?: unknown): Promise<void> => {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- the resolver of a `void` promise needs its (ignored) argument once the type parameter is `undefined`.
      called.resolve(undefined);
      if (reportsFailure(error)) {
        failure ??= error;
        return Promise.resolve();
      }
      started ??= continuation();
      return started;
    },
    settled: async (): Promise<void> => {
      if (started === undefined && responseSettled !== undefined) {
        await Promise.race([called.promise, responseSettled]);
      }
      await started;
      if (reportsFailure(failure)) throw failure;
    },
  };
};

export { forwardFrom };
export type { Forwarded };

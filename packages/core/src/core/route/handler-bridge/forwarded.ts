import type { Next } from 'hono';

/**
 * The continuation a handler was handed, and the one it
 * started.
 */
interface Forwarded {
  readonly next: Next;
  readonly settled: () => Promise<void>;
}

/**
 * Remembers the continuation a handler starts, so it can be
 * awaited.
 */
const forwardFrom = (continuation: Next): Forwarded => {
  let started: Promise<void> | undefined = undefined;
  return {
    next: (): Promise<void> => {
      started = continuation();
      return started;
    },
    settled: async (): Promise<void> => {
      await started;
    },
  };
};

export { forwardFrom };
export type { Forwarded };

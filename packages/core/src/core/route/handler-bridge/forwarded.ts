import type { Next } from 'hono';

interface Forwarded {
  readonly next: Next;
  readonly settled: () => Promise<void>;
}

const forwardFrom = (continuation: Next): Forwarded => {
  let started: Promise<void> | undefined = undefined;
  return {
    next: (): Promise<void> => {
      started ??= continuation();
      return started;
    },
    settled: async (): Promise<void> => {
      await started;
    },
  };
};

export { forwardFrom };
export type { Forwarded };

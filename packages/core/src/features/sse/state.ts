import type { SseResponse, StartSignal } from '#adapter/core/response/sse-stream/index';

const noStream = (): void => {
  // Nothing to announce.
};

interface StartWaiter {
  readonly settle: StartSignal;
  readonly started: Promise<void>;
}

const startWaiter = (): StartWaiter => {
  let settle: StartSignal = noStream;
  // oxlint-disable-next-line promise/avoid-new -- the resolver is produced through the callback form that predates Promise.withResolvers.
  const started = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { settle, started };
};

const RAW_STATE = Symbol('sseState');

interface SseState {
  opened: SseResponse | undefined;
  status: () => number | undefined;
  waiter: StartWaiter;
}

type SseHolder = Record<symbol, SseState | undefined>;

export { RAW_STATE, noStream, startWaiter };
export type { SseHolder, SseState, StartWaiter };

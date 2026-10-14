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
  // oxlint-disable-next-line promise/avoid-new
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

const installedOn = new WeakSet<object>();

export { RAW_STATE, installedOn, noStream, startWaiter };
export type { SseHolder, SseState, StartWaiter };

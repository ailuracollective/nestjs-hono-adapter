import type {
  SseResponse,
  StartSignal,
} from '#adapter/core/response/sse-stream/index';

/** Stands in for a stream that never started. */
const noStream = (): void => {
  // Nothing to announce.
};

/** The promise a route's stream settles, and its settler. */
interface StartWaiter {
  readonly settle: StartSignal;
  readonly started: Promise<void>;
}

/** Builds the waiter for one request's stream. */
const startWaiter = (): StartWaiter => {
  let settle: StartSignal = noStream;
  // oxlint-disable-next-line promise/avoid-new
  const started = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { settle, started };
};

/** The symbol a context keeps its event-stream state under. */
const RAW_STATE = Symbol('sseState');

/** The state an open event stream is held in. */
interface SseState {
  opened: SseResponse | undefined;
  status: () => number | undefined;
  waiter: StartWaiter;
}

/** A context that holds event-stream state under a symbol. */
type SseHolder = Record<symbol, SseState | undefined>;

/** The context prototypes the raw getter is installed on. */
const installedOn = new WeakSet<object>();

export { RAW_STATE, installedOn, noStream, startWaiter };
export type { SseHolder, SseState, StartWaiter };

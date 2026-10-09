import type { NestContext } from '../core/context.ts';
import {
  reportDisconnect,
  tuneableSocket,
} from '../core/socket.ts';
import { SseResponse } from '../core/sse-stream.ts';
import type { StartSignal } from '../core/sse-stream.ts';

/** Stands in for a stream that never started. */
function noStream(): void {
  // Nothing to announce.
}

/**
 * The promise a route's stream settles, and the handle that
 * settles it: what `Promise.withResolvers` returns, and newer
 * than the lib this package compiles against.
 */
interface StartWaiter {
  readonly settle: StartSignal;
  readonly started: Promise<void>;
}

/**
 * Builds the waiter for one request's stream. The promise is
 * settled from outside its own body, which is what a deferred
 * is: `async` here would resolve at the first `await`.
 */
function startWaiter(): StartWaiter {
  let settle: StartSignal = noStream;
  // oxlint-disable-next-line promise/avoid-new
  const started = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return { settle, started };
}

/**
 * Where a context keeps what the `raw` getter needs to build
 * its stream.
 */
const RAW_STATE = Symbol('sseState');

/**
 * What the `raw` getter reads when it is asked to open a
 * stream.
 */
interface SseState {
  opened: SseResponse | undefined;
  status: () => number | undefined;
  waiter: StartWaiter;
}

/**
 * A context carrying the state its `raw` getter needs. The
 * holder is a record rather than an interface extending the
 * context because Hono's context type has no symbol index
 * signature, and adding one means asserting through `unknown`.
 */
type SseHolder = Record<symbol, SseState | undefined>;

/**
 * The context prototypes the getter is already on, weak so none
 * of them is kept alive by it.
 */
const installedOn = new WeakSet<object>();

/** The headers Hono already recorded for the answer. */
function recordedHeaders(
  context: NestContext,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [name, value] of context.res.headers) {
    if (name !== 'content-type') {
      record[name] = value;
    }
  }
  return record;
}

/**
 * Gives the object Nest reads as its response the surface its
 * SSE path touches, once a stream has been opened on it. The
 * `raw` that names this writable is what keeps the frames
 * travelling through Hono: writing them straight into
 * `c.env.outgoing` would make the transport write this
 * adapter's `Response` to the same socket a second time.
 * `req.raw` stays the real incoming message, which is what
 * tunes the socket and reports a disconnect.
 */
function installSurface(
  context: NestContext,
  response: SseResponse,
): void {
  Object.defineProperties(context, {
    statusCode: {
      configurable: true,
      get: (): number | undefined => response.statusCode,
    },
    writableEnded: {
      configurable: true,
      get: (): boolean => response.writableEnded,
    },
  });
  Object.assign(context, {
    emit: response.emit.bind(response),
    end: response.end.bind(response),
    flushHeaders: response.flushHeaders.bind(response),
    getHeaders: (): Record<string, string> =>
      recordedHeaders(context),
    on: response.on.bind(response),
    once: response.once.bind(response),
    removeListener: response.removeListener.bind(response),
    setHeader: response.setHeader.bind(response),
    write: response.write.bind(response),
    writeHead: response.writeHead.bind(response),
  });
}

/**
 * Watches for the client walking away and answers with what
 * says so. Nest ends an event stream when the socket closes,
 * and a runtime that carries a request without carrying the
 * socket never closes one; the request itself is what is left
 * to end, and the listener dies with it.
 */
function watchDisconnect(context: NestContext): () => void {
  const { incoming } = context.env;
  // Nest's SSE path reads `req.raw`, the incoming message itself,
  // not the request bag: that is the socket it tunes and reads
  // 'close' from, so it is tuned here, before the stream is handed
  // over, and the disconnect is reported on the same object.
  const socket = tuneableSocket(incoming.socket);
  const report = (): void => {
    reportDisconnect(socket);
  };
  incoming.on('close', report);
  return report;
}

/**
 * Puts `raw` on Hono's context, once, so no request defines a
 * property: `Object.defineProperty` costs about 285 nanoseconds
 * where a plain property costs about 18, and on the request
 * path this was the largest single cost left. The prototype is
 * remembered rather than assumed, so a second application in
 * the same process does not redefine what the first installed.
 */
function installRawGetter(context: NestContext): void {
  const prototype = Object.getPrototypeOf(context) as object;
  if (installedOn.has(prototype)) {
    return;
  }
  installedOn.add(prototype);
  Object.defineProperty(prototype, 'raw', {
    configurable: true,
    get(this: NestContext): SseResponse {
      const holder = this as unknown as SseHolder;
      const state = holder[RAW_STATE];
      if (state === undefined) {
        throw new TypeError(
          'An event stream was asked for on a response this adapter did not mount one on.',
        );
      }
      if (state.opened === undefined) {
        const report = watchDisconnect(this);
        state.opened = new SseResponse(state.status, {
          onCommit: (answer): void => {
            this.res = answer;
          },
          onDisconnect: report,
          signal: state.waiter.settle,
        });
        installSurface(this, state.opened);
      }
      return state.opened;
    },
  });
}

/**
 * Opens an event stream on the response Nest reads, and says
 * when it started. The surface itself opens on the first read
 * of `raw` rather than on every request, because that read is
 * what tells an event stream apart from any other answer — so a
 * route that streams nothing never builds the writable, the web
 * stream behind it, or the commit. The promise it answers with
 * is the one thing built per request, and it is built here
 * rather than on the first read because the bridge has to be
 * handed it before the handler runs; it settles when the stream
 * commits its headers, and a route that answers without
 * streaming never settles it, which needs nothing torn down
 * since the promise carries no listener.
 */
function mountSse(
  context: NestContext,
  status: () => number | undefined,
): Promise<unknown> {
  installRawGetter(context);
  const waiter = startWaiter();
  const holder = context as unknown as SseHolder;
  holder[RAW_STATE] = { opened: undefined, status, waiter };
  return waiter.started;
}

export { mountSse };

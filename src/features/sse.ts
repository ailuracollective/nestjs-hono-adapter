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
 * Builds the waiter for one request's stream. A route that
 * streams nothing never settles it and needs nothing torn down
 * to stop waiting: the promise carries no listener.
 *
 * The promise is settled from outside its own body, which is
 * what a deferred is: `async` here would resolve at the first
 * `await` and settle nothing afterwards.
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
 * A context carrying the state its `raw` getter needs.
 *
 * The holder is a record rather than an interface extending the
 * context because Hono's context type carries no symbol index
 * signature, and one would have to be asserted through
 * `unknown` to add. Both assertions here are that, and the file
 * says what each is for.
 */
type SseHolder = Record<symbol, SseState | undefined>;

/**
 * The context prototypes the getter is already on.
 *
 * Weak, so holding one of them does not keep a Hono context
 * class alive after the application that used it is gone.
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
 * SSE path touches, once an event stream has been opened on it,
 * so the same object serves every supported Nest major.
 *
 * Nest 11 and 12 both prefer `res.raw` when it is set, and Nest
 * 12 never reads the response's own members then. The `raw`
 * that names this writable is what keeps the frames travelling
 * through Hono: writing them straight into `c.env.outgoing`
 * would bypass the `Response` this adapter returns, and the
 * transport would then write that response into the same socket
 * a second time. `req.raw` is the real incoming message, which
 * is what tunes the socket and reports a disconnect.
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
 * Watches for the client walking away, and answers with what
 * says so.
 *
 * Nest ends an event stream when the request’s socket closes,
 * and a runtime that carries a request without carrying the
 * socket behind it never closes one. The request itself is what
 * is left: a platform that cannot close a socket it does not
 * have can still end the request, and this listens for that.
 * The answer is handed to the stream too, so a reader that lets
 * go of the bytes reaches the same end.
 *
 * The listener belongs to the request, which dies with it.
 */
function watchDisconnect(context: NestContext): () => void {
  const { incoming } = context.env;
  // Nest’s SSE path reads `req.raw`, the incoming message itself,
  // not the request bag: the socket it tunes and reads ‘close’
  // from is this one, so it is tuned here, before the stream
  // behind `raw` is handed to Nest, and the disconnect is
  // reported on the same object.
  const socket = tuneableSocket(incoming.socket);
  const report = (): void => {
    reportDisconnect(socket);
  };
  incoming.on('close', report);
  return report;
}

/**
 * Puts `raw` on Hono's context, once, so that no request has to
 * define a property.
 *
 * `Object.defineProperty` costs about 285 nanoseconds where a
 * plain property costs about 18, and on the request path this
 * was the largest single cost left — more than everything else
 * the adapter does put together. The getter belongs on the
 * prototype for the same reason any accessor does: every
 * context gets it, so no context should carry its own copy.
 *
 * A Hono application holds one context class, so this runs once
 * per process in practice. The prototype is remembered rather
 * than assumed, so a second application in the same process
 * does not redefine what the first installed.
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
 * when it started. The stream is the destination `SseStream`
 * pipes into, so nothing is buffered until Nest commits the
 * headers, which is also the moment the promise settles.
 *
 * The surface itself opens on the first read of `raw` rather
 * than on every request, because that read is what tells an
 * event stream apart from any other answer. Nest reads `res.raw
 * ?? res` first on its SSE path and never reads it anywhere
 * else, so an ordinary route never builds the writable or the
 * web stream behind it, and never has its answer committed as a
 * stream with the stream's own content type and headers: what
 * it calls on the response stays Hono's own API, which is what
 * `@Res()` handlers are documented to write through.
 *
 * The promise it answers with is the one thing built per
 * request, and it is built here rather than on the first read
 * of `raw` because the bridge has to be handed it before the
 * handler runs. It settles when the stream commits its headers,
 * and a route that answers without streaming never settles it,
 * which needs nothing torn down to stop waiting since the
 * promise carries no listener. The surface, the writable and
 * the web stream behind them are all still built on that first
 * read, so a route that streams nothing reaches none of them.
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

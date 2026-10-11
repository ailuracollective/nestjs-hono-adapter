import { HttpStatus, Logger } from '@nestjs/common';
import type { Context, MiddlewareHandler } from 'hono';

import type { NestContext, NestEnv } from '../core/context.ts';
import { toNestRequest } from '../core/request.ts';
import type {
  NestRequest,
  TrustProxy,
} from '../core/request.ts';

/** The answer Nest's own adapters give while shutting down. */
const CLOSING_BODY = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

/**
 * What a step that produces nothing looks like: the guard hands
 * one to CORS when it wants only the headers.
 */
const NOOP_NEXT = (): Promise<void> => Promise.resolve();

/** What the guard reads on each request to know what applies. */
interface GuardState {
  /**
   * Whether the application has configured CORS. Asked apart
   * from the step itself so the step can be built once while
   * whether it applies is still read per request:
   * `enableCors()` runs after the adapter is constructed.
   */
  readonly corsEnabled: () => boolean;
  /** The CORS step. */
  readonly cors: MiddlewareHandler<NestEnv>;
  /**
   * Whether the server is closing and a request must be
   * refused.
   */
  readonly closing: () => boolean;
}

/**
 * The response an instrumentation hook may read and adjust: the
 * Node one where the transport carries it, and the stand-in
 * that writes through the Hono context where it does not. It is
 * the same object the security hook Nest registers is handed.
 */
interface HookResponse {
  removeHeader: (name: string) => unknown;
  setHeader: (name: string, value: string) => unknown;
}

/**
 * The hook Nest's instrumentation registers to run at the start
 * of a request. It continues the chain by calling `done`, the
 * way the platform adapters' does.
 */
type OnRequestHook = (
  request: NestRequest,
  response: HookResponse,
  done: () => void,
) => unknown;

/** The hook registered to run once a response exists. */
type OnResponseHook = (
  request: NestRequest,
  response: HookResponse,
) => unknown;

/** The two objects a hook is handed, built once per request. */
interface HookArgs {
  readonly request: NestRequest;
  readonly response: HookResponse;
}

/** What the instrumentation reads on each request. */
interface InstrumentationState {
  /** The hook for the start of a request, if one is registered. */
  readonly onRequest: () => OnRequestHook | undefined;
  /** The hook for an answer, if one is registered. */
  readonly onResponse: () => OnResponseHook | undefined;
  /** How much of a proxy's word the deployment believes. */
  readonly trustProxy: TrustProxy;
}

/** Reports a failure that can no longer change the answer. */
const logger = new Logger('Instrumentation');

/**
 * The refusal a closing server answers with. A request already
 * in flight is left to finish; one arriving afterwards is
 * refused rather than accepted and then dropped when the socket
 * goes away. The refusal asks for the connection not to be
 * reused, which is what lets a balancer drain the instance
 * faster.
 */
function closingAnswer(): Response {
  return Response.json(CLOSING_BODY, {
    headers: { connection: 'close' },
    status: HttpStatus.SERVICE_UNAVAILABLE,
  });
}

/**
 * The refusal written over the headers CORS just added. The
 * CORS step is given a `next` that produces nothing, because a
 * Hono middleware may not answer with a value where `next` is
 * expected; the answer is placed on the context afterwards,
 * which is where Hono reads it from.
 */
async function refuse(
  context: Context<NestEnv, string>,
  cors: MiddlewareHandler<NestEnv>,
): Promise<Response> {
  await cors(context, NOOP_NEXT);
  context.res = closingAnswer();
  return context.res;
}

/**
 * One step through the dispatcher for the two things a request
 * may need before it reaches a route. CORS and the closing
 * refusal were two middlewares, and each mounted one is a step
 * every request pays — about 400 nanoseconds each, on a path
 * costing over a hundred microseconds — while neither can know
 * at construction time whether CORS will be enabled later or a
 * 503 was asked for. An application that configured neither now
 * reaches its route after two reads and no extra step. CORS
 * runs first, so a request refused while closing keeps the
 * headers it would have been answered with, and it is handed in
 * rather than imported because the composition root is what
 * wires features into one chain.
 */
function guardBridge(
  state: GuardState,
): MiddlewareHandler<NestEnv> {
  return async (context, next) => {
    const corsEnabled = state.corsEnabled();
    const closing = state.closing();
    if (!corsEnabled) {
      if (closing) {
        return closingAnswer();
      }
      return next();
    }
    if (!closing) {
      return state.cors(context, next);
    }
    await refuse(context, state.cors);
    return context.res;
  };
}

/**
 * The bindings a transport attached. Hono types them as
 * present, but a request served by a bare Hono application
 * arrived with none at all, so they are read as the optional
 * thing they are.
 */
function bindingsOf(context: {
  readonly env?: NestEnv['Bindings'];
}): NestEnv['Bindings'] | undefined {
  return context.env;
}

/** The response stand-in, which writes through the context. */
function standInFor(context: NestContext): HookResponse {
  return {
    removeHeader: (name: string): void => {
      context.res.headers.delete(name);
    },
    setHeader: (name: string, value: string): void => {
      context.header(name, value);
    },
  };
}

/**
 * The response a hook is handed. The Node transport carries the
 * real one; where there is none — and where the request arrived
 * with no bindings at all — the stand-in writes through the
 * Hono context the way the security hook's does.
 */
function outgoingOf(context: NestContext): HookResponse {
  const standIn = standInFor(context);
  const bindings = bindingsOf(context);
  if (bindings === undefined) {
    return standIn;
  }
  return bindings.outgoing ?? standIn;
}

/** Builds the request and response a hook reads. */
function hookArgsOf(
  context: NestContext,
  trustProxy: TrustProxy,
): HookArgs {
  return {
    request: toNestRequest(context, { trustProxy }),
    response: outgoingOf(context),
  };
}

/**
 * Holds the chain until the hook calls `done`, which is how a
 * hook reports asynchronously. A returned thenable is awaited
 * instead, and its resolution continues the chain without
 * `done`.
 */
async function holdRequest(
  hook: OnRequestHook,
  args: HookArgs,
): Promise<void> {
  let continued: (() => void) | undefined = undefined;
  // oxlint-disable-next-line promise/avoid-new -- the hook continues through the callback it is handed, which is the one thing an awaited promise cannot express.
  const held = new Promise<void>((resolve) => {
    continued = resolve;
  });
  const outcome: unknown = hook(
    args.request,
    args.response,
    () => {
      if (continued !== undefined) {
        continued();
      }
    },
  );
  if (
    outcome !== null &&
    (typeof outcome === 'object' ||
      typeof outcome === 'function') &&
    'then' in outcome &&
    typeof outcome.then === 'function'
  ) {
    await Promise.resolve(outcome);
    return;
  }
  await held;
}

/**
 * Runs the response hook. The answer is already decided by the
 * time it runs, so a failure it raises is logged rather than
 * answered: letting it escape would replace a good answer with
 * the error one.
 */
async function reportAnswered(
  hook: OnResponseHook | undefined,
  args: HookArgs,
): Promise<void> {
  if (hook === undefined) {
    return;
  }
  try {
    await hook(args.request, args.response);
  } catch (error: unknown) {
    logger.error('The response hook failed.', error);
  }
}

/**
 * The step that runs the two instrumentation hooks around every
 * request. It is built once and reads the hooks as it runs,
 * because `setOnRequestHook()` is called after the adapter is
 * constructed. A deployment that registers neither pays the
 * step and nothing else.
 */
function instrumentationBridge(
  state: InstrumentationState,
): MiddlewareHandler<NestEnv> {
  return async (context, next) => {
    const onRequest = state.onRequest();
    const onResponse = state.onResponse();
    if (onRequest === undefined && onResponse === undefined) {
      return next();
    }
    const args = hookArgsOf(context, state.trustProxy);
    try {
      if (onRequest !== undefined) {
        await holdRequest(onRequest, args);
      }
      // oxlint-disable-next-line node/callback-return -- the response hook runs once the chain has settled, so the result of next() is awaited here rather than returned through: there is nowhere to return it from.
      await next();
    } finally {
      await reportAnswered(onResponse, args);
    }
  };
}

export { guardBridge, instrumentationBridge };
export type { GuardState, OnRequestHook, OnResponseHook };

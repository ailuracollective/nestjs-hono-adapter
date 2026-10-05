import { HttpStatus } from '@nestjs/common';
import type { Context, MiddlewareHandler } from 'hono';

import type { NodeEnv } from '../core/context.ts';

/** The answer Nest's own adapters give while shutting down. */
const CLOSING_BODY = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

/**
 * What a step that produces nothing looks like: the guard hands
 * one to CORS when it wants only the headers, and never to
 * anything that would wait for it.
 */
const NOOP_NEXT = (): Promise<void> => Promise.resolve();

/** What the guard reads on each request to know what applies. */
interface GuardState {
  /**
   * Whether the application has configured CORS. Asked apart
   * from the step itself so the step can be built once, while
   * whether it applies is still read per request:
   * `enableCors()` runs after the adapter is constructed.
   */
  readonly corsEnabled: () => boolean;
  /** The CORS step. */
  readonly cors: MiddlewareHandler<NodeEnv>;
  /**
   * Whether the server is closing and a request must be
   * refused.
   */
  readonly closing: () => boolean;
}

/**
 * The refusal a closing server answers a request with.
 *
 * A request already in flight is left to finish; one that
 * arrives afterwards is refused instead of being accepted and
 * then dropped when the socket goes away. The refusal asks for
 * the connection not to be reused, which is what lets a
 * balancer drain the instance faster — the same header the
 * Express adapter sends with its own answer.
 */
function closingAnswer(): Response {
  return Response.json(CLOSING_BODY, {
    headers: { connection: 'close' },
    status: HttpStatus.SERVICE_UNAVAILABLE,
  });
}

/**
 * The refusal a closing server sends, written over the headers
 * CORS just added.
 *
 * The CORS step is given a `next` that produces nothing,
 * because a Hono middleware may not answer with a value where
 * `next` is expected; the answer is placed on the context
 * afterwards, which is where Hono reads it from.
 */
async function refuse(
  context: Context<NodeEnv, string>,
  cors: MiddlewareHandler<NodeEnv>,
): Promise<Response> {
  await cors(context, NOOP_NEXT);
  context.res = closingAnswer();
  return context.res;
}

/**
 * One step through the dispatcher for the two things a request
 * may need before it reaches a route.
 *
 * CORS and the closing refusal were two middlewares, and each
 * mounted one is a step every request pays — about 400
 * nanoseconds each, on a path that costs over a hundred
 * microseconds. An application that configured neither paid for
 * both anyway, since neither can know when the Hono application
 * is built whether CORS will be enabled later or whether the
 * deployment asked for the 503.
 *
 * Both are still read on every request, because both can change
 * while the server is running: `enableCors()` is called after
 * the adapter is constructed, and the closing flag is set
 * during shutdown. What changes is that an application which
 * configured neither reaches its route after two reads and no
 * extra step.
 *
 * The CORS step is handed in rather than imported, because
 * features are siblings: the composition root is what wires two
 * of them into one chain.
 *
 * CORS runs first, so a request refused while closing keeps the
 * headers it would have been answered with.
 */
function guardBridge(
  state: GuardState,
): MiddlewareHandler<NodeEnv> {
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

export { guardBridge };
export type { GuardState };

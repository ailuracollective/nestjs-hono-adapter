import { HttpStatus } from '@nestjs/common';
import type { Context, MiddlewareHandler } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { passed } from './passed.ts';

/** The refusal body a closing server answers with. */
const CLOSING_BODY = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

/** The no-op continuation the guard hands CORS. */
const NOOP_NEXT = (): Promise<void> => Promise.resolve();

/** What the guard reads on each request to know what applies. */
interface GuardState {
  /** Whether the application has configured CORS. */
  readonly corsEnabled: () => boolean;
  /** The CORS step. */
  readonly cors: MiddlewareHandler<NestEnv>;
  /** Whether the server is closing and requests are refused. */
  readonly closing: () => boolean;
}

/** The refusal a closing server answers with. */
const closingAnswer = (): Response =>
  Response.json(CLOSING_BODY, {
    headers: { connection: 'close' },
    status: HttpStatus.SERVICE_UNAVAILABLE,
  });

/** Writes the closing refusal over the headers CORS just added. */
const refuse = async (
  context: Context<NestEnv, string>,
  cors: MiddlewareHandler<NestEnv>,
): Promise<Response> => {
  await cors(context, NOOP_NEXT);
  context.res = closingAnswer();
  return context.res;
};

/** Runs CORS and the closing refusal as one middleware step. */
const guardStep =
  (state: GuardState): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    const corsEnabled = state.corsEnabled();
    const closing = state.closing();
    if (!corsEnabled) {
      if (closing) {
        return closingAnswer();
      }
      return passed(next);
    }
    if (!closing) {
      return passed(() => state.cors(context, next));
    }
    await refuse(context, state.cors);
    return context.res;
  };

export { guardStep };
export type { GuardState };

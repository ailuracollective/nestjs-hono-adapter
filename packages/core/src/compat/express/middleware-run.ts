import type { NestContext } from '#adapter/core/context';

import { continueChain } from './middleware-shape.ts';
import type { ExpressErrorMiddleware } from './middleware-shape.ts';
import { expressRequest, expressResponse } from './request.ts';

/** Runs an Express-style error middleware inside Hono's chain. */
const wrapExpressMiddleware =
  (handler: ExpressErrorMiddleware) =>
  async (
    context: NestContext,
    next: () => Promise<void>,
  ): Promise<void> => {
    await handler(
      undefined,
      expressRequest(context),
      expressResponse(context),
      continueChain(next),
    );
  };

export { wrapExpressMiddleware };

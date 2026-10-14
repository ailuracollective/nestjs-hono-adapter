import type { NestContext } from '#adapter/core/context';

import { forwardFrom } from '#adapter/core/route/handler-bridge/forwarded';
import { continueChain } from './middleware-shape.ts';
import type { ExpressErrorMiddleware } from './middleware-shape.ts';
import { expressRequest, expressResponse } from './request.ts';

const wrapExpressMiddleware =
  (handler: ExpressErrorMiddleware) =>
  async (context: NestContext, next: () => Promise<void>): Promise<void> => {
    // An Express middleware may hand next() to something it never awaits (nestjs-i18n does), so the bridge has to hold the continuation open itself.
    const forwarded = forwardFrom(next);
    await handler(
      undefined,
      expressRequest(context),
      expressResponse(context),
      continueChain(forwarded.next),
    );
    await forwarded.settled();
  };

export { wrapExpressMiddleware };

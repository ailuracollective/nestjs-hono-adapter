import type { BridgeAdapter, BridgeTarget, NestContext } from '@ailura/nestjs-hono-adapter';

import { fitResponse, upgradedStatus } from './response.ts';

/**
 * Nest applies a route's return value after the interceptors have run, so an Inertia render would
 * be overwritten by an empty answer. A finalized context has already been answered and is kept.
 */
const patchReply = (adapter: BridgeAdapter): void => {
  const reply = adapter.reply.bind(adapter);
  adapter.reply = (response, body, statusCode): void => {
    if (response.finalized) return;
    reply(response, body, statusCode);
  };
};

const patchRedirect = (adapter: BridgeAdapter): void => {
  const redirect = adapter.redirect.bind(adapter);
  adapter.redirect = (response, statusCode, url): void => {
    redirect(response, upgradedStatus(response, statusCode), url);
  };
};

const fitFor =
  (adapter: BridgeAdapter) =>
  async (context: NestContext, next: () => Promise<void>): Promise<void> => {
    fitResponse(context, adapter);
    // oxlint-disable-next-line node/callback-return -- Hono's `next()` resolves to the context; returning it would make the answer the context itself.
    await next();
  };

const installInertia = (target: BridgeTarget): void => {
  const { adapter } = target;
  patchReply(adapter);
  patchRedirect(adapter);
  target.hono.use('*', fitFor(adapter));
};

export { installInertia };

import type { MiddlewareHandler } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import type { TrustProxy } from '#adapter/core/request/request';
import {
  holdRequest,
  hookArgsOf,
  reportAnswered,
} from './hooks.ts';
import type { OnRequestHook, OnResponseHook } from './hooks.ts';

/** What the instrumentation reads on each request. */
interface InstrumentationState {
  /** The hook for the start of a request, if one is registered. */
  readonly onRequest: () => OnRequestHook | undefined;
  /** The hook for an answer, if one is registered. */
  readonly onResponse: () => OnResponseHook | undefined;
  /** How much of a proxy's word the deployment believes. */
  readonly trustProxy: TrustProxy;
}

/** Runs the two instrumentation hooks around every request. */
const instrumentationStep =
  (state: InstrumentationState): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    if (
      state.onRequest() === undefined &&
      state.onResponse() === undefined
    ) {
      // oxlint-disable-next-line node/callback-return -- next() resolves to the context, so returning it answers with the context itself.
      await next();
      return;
    }
    const args = hookArgsOf(context, state.trustProxy);
    try {
      const onRequest = state.onRequest();
      if (onRequest !== undefined) {
        await holdRequest(onRequest, args);
      }
      // oxlint-disable-next-line node/callback-return -- the response hook runs once the chain has settled, so next() is awaited here rather than returned through.
      await next();
    } finally {
      await reportAnswered(state.onResponse(), args);
    }
  };

export { instrumentationStep };

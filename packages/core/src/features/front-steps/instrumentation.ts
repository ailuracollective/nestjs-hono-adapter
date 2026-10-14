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

export { instrumentationStep };

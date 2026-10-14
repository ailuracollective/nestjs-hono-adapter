import type {
  NestContext,
  NestEnv,
} from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type { TrustProxy } from '#adapter/core/request/request';

import type { HookArgs, HookResponse } from './types.ts';

/**
 * The bindings the transport attached, absent on a bare Hono
 * request.
 */
const bindingsOf = (context: {
  readonly env?: NestEnv['Bindings'];
}): NestEnv['Bindings'] | undefined => context.env;

/** The response stand-in, which writes through the context. */
const standInFor = (context: NestContext): HookResponse => ({
  removeHeader: (name: string): void => {
    context.res.headers.delete(name);
  },
  setHeader: (name: string, value: string): void => {
    context.header(name, value);
  },
});

/**
 * The response a hook is handed: the transport's, or the
 * stand-in.
 */
const outgoingOf = (context: NestContext): HookResponse => {
  const standIn = standInFor(context);
  const bindings = bindingsOf(context);
  if (bindings === undefined) {
    return standIn;
  }
  return bindings.outgoing ?? standIn;
};

/** Builds the request and response a hook reads. */
const hookArgsOf = (
  context: NestContext,
  trustProxy: TrustProxy,
): HookArgs => ({
  request: toNestRequest(context, { trustProxy }),
  response: outgoingOf(context),
});

export { bindingsOf, hookArgsOf, outgoingOf, standInFor };

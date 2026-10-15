import { HttpStatus, Logger } from '@nestjs/common';
import type { Context, MiddlewareHandler } from 'hono';

import type { NestContext, NestEnv } from '#adapter/core/context';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestRequest, TrustProxy } from '#adapter/core/request/request';

const RESPONSE_HOOK_TIMEOUT_MS = 1000;

const logger = new Logger('Instrumentation');

interface HookResponse {
  removeHeader: (name: string) => unknown;
  setHeader: (name: string, value: string) => unknown;
}

type OnRequestHook = (request: NestRequest, response: HookResponse, done: () => void) => unknown;

type OnResponseHook = (request: NestRequest, response: HookResponse) => unknown;

interface HookArgs {
  readonly request: NestRequest;
  readonly response: HookResponse;
}

interface InstrumentationState {
  readonly onRequest: () => OnRequestHook | undefined;
  readonly onResponse: () => OnResponseHook | undefined;
  readonly trustProxy: () => TrustProxy;
}

interface GuardState {
  readonly corsEnabled: () => boolean;
  readonly cors: MiddlewareHandler<NestEnv>;
  readonly closing: () => boolean;
}

const CLOSING_BODY = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

const NOOP_NEXT = (): Promise<void> => Promise.resolve();

const bindingsOf = (context: {
  readonly env?: NestEnv['Bindings'];
}): NestEnv['Bindings'] | undefined => context.env;

const standInFor = (context: NestContext): HookResponse => ({
  removeHeader: (name: string): void => {
    context.res.headers.delete(name);
  },
  setHeader: (name: string, value: string): void => {
    context.header(name, value);
  },
});

const outgoingOf = (context: NestContext): HookResponse => {
  const standIn = standInFor(context);
  const bindings = bindingsOf(context);
  if (bindings === undefined) return standIn;
  return bindings.outgoing ?? standIn;
};

const hookArgsOf = (context: NestContext, trustProxy: TrustProxy): HookArgs => ({
  request: toNestRequest(context, { trustProxy }),
  response: outgoingOf(context),
});

const holdRequest = async (hook: OnRequestHook, args: HookArgs): Promise<void> => {
  let continued: (() => void) | undefined = undefined;
  // oxlint-disable-next-line promise/avoid-new -- the hook continues through the callback it is handed, which is the one thing an awaited promise cannot express.
  const held = new Promise<void>((resolve) => {
    continued = resolve;
  });
  const outcome: unknown = hook(args.request, args.response, () => {
    if (continued !== undefined) continued();
  });
  if (
    outcome !== null &&
    (typeof outcome === 'object' || typeof outcome === 'function') &&
    'then' in outcome &&
    typeof outcome.then === 'function'
  ) {
    await Promise.race([Promise.resolve(outcome), held]);
    return;
  }
  await held;
};

const runResponseHook = async (hook: OnResponseHook, args: HookArgs): Promise<void> => {
  try {
    await hook(args.request, args.response);
  } catch (error: unknown) {
    logger.error('The response hook failed.', error);
  }
};

const reportAnswered = async (hook: OnResponseHook | undefined, args: HookArgs): Promise<void> => {
  if (hook === undefined) return;
  const { promise, resolve } = Promise.withResolvers<undefined>();
  const timer = setTimeout(resolve, RESPONSE_HOOK_TIMEOUT_MS);
  try {
    await Promise.race([runResponseHook(hook, args), promise]);
  } finally {
    clearTimeout(timer);
  }
};

const passed = async (run: () => Promise<unknown>): Promise<Response | undefined> => {
  const answered = await run();
  return answered instanceof Response ? answered : undefined;
};

const closingAnswer = (): Response =>
  Response.json(CLOSING_BODY, {
    headers: { connection: 'close' },
    status: HttpStatus.SERVICE_UNAVAILABLE,
  });

const refuse = async (
  context: Context<NestEnv, string>,
  cors: MiddlewareHandler<NestEnv>,
): Promise<Response> => {
  await cors(context, NOOP_NEXT);
  // The refusal replaces the response, so the headers an earlier step set ride along here.
  const answer = closingAnswer();
  for (const [name, value] of context.res.headers) {
    answer.headers.append(name, value);
  }
  context.res = answer;
  return context.res;
};

const guardStep =
  (state: GuardState): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    const corsEnabled = state.corsEnabled();
    const closing = state.closing();
    if (!corsEnabled) {
      if (closing) return closingAnswer();
      return passed(next);
    }
    if (!closing) return passed(() => state.cors(context, next));
    await refuse(context, state.cors);
    return context.res;
  };

const instrumentationStep =
  (state: InstrumentationState): MiddlewareHandler<NestEnv> =>
  async (context, next) => {
    if (state.onRequest() === undefined && state.onResponse() === undefined) {
      // oxlint-disable-next-line node/callback-return -- next() resolves to the context, so returning it answers with the context itself.
      await next();
      return;
    }
    const args = hookArgsOf(context, state.trustProxy());
    try {
      const onRequest = state.onRequest();
      if (onRequest !== undefined) await holdRequest(onRequest, args);
      // oxlint-disable-next-line node/callback-return -- the response hook runs once the chain has settled, so next() is awaited here rather than returned through.
      await next();
    } finally {
      await reportAnswered(state.onResponse(), args);
    }
  };

export { bindingsOf, guardStep, hookArgsOf, instrumentationStep, outgoingOf, passed, standInFor };
export type {
  GuardState,
  HookArgs,
  HookResponse,
  InstrumentationState,
  OnRequestHook,
  OnResponseHook,
};

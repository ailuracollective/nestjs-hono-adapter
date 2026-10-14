import { RESPONSE_HOOK_TIMEOUT_MS, logger } from './types.ts';
import type {
  HookArgs,
  OnRequestHook,
  OnResponseHook,
} from './types.ts';

/**
 * Holds the chain until the hook calls `done` or returns a
 * thenable.
 */
const holdRequest = async (
  hook: OnRequestHook,
  args: HookArgs,
): Promise<void> => {
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
    await Promise.race([Promise.resolve(outcome), held]);
    return;
  }
  await held;
};

/** Runs the response hook, logging a failure it raises. */
const runResponseHook = async (
  hook: OnResponseHook,
  args: HookArgs,
): Promise<void> => {
  try {
    await hook(args.request, args.response);
  } catch (error: unknown) {
    logger.error('The response hook failed.', error);
  }
};

/**
 * Releases the middleware after a bounded wait for header
 * changes.
 */
const reportAnswered = async (
  hook: OnResponseHook | undefined,
  args: HookArgs,
): Promise<void> => {
  if (hook === undefined) {
    return;
  }
  const { promise, resolve } =
    Promise.withResolvers<undefined>();
  const timer = setTimeout(resolve, RESPONSE_HOOK_TIMEOUT_MS);
  try {
    await Promise.race([runResponseHook(hook, args), promise]);
  } finally {
    clearTimeout(timer);
  }
};

export { holdRequest, reportAnswered };

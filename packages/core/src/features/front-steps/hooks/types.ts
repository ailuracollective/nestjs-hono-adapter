import { Logger } from '@nestjs/common';

import type { NestRequest } from '#adapter/core/request/request';

/** The response surface a hook reads and adjusts. */
interface HookResponse {
  removeHeader: (name: string) => unknown;
  setHeader: (name: string, value: string) => unknown;
}

/** The hook run at the start of a request, continued by `done`. */
type OnRequestHook = (
  request: NestRequest,
  response: HookResponse,
  done: () => void,
) => unknown;

/** The hook run once a response exists. */
type OnResponseHook = (
  request: NestRequest,
  response: HookResponse,
) => unknown;

/** The two objects a hook is handed, built once per request. */
interface HookArgs {
  readonly request: NestRequest;
  readonly response: HookResponse;
}

/** Maximum time a response hook may hold the middleware. */
const RESPONSE_HOOK_TIMEOUT_MS = 1000;

/** Reports a failure that can no longer change the answer. */
const logger = new Logger('Instrumentation');

export { RESPONSE_HOOK_TIMEOUT_MS, logger };
export type {
  HookArgs,
  HookResponse,
  OnRequestHook,
  OnResponseHook,
};

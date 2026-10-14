import { Logger } from '@nestjs/common';
import type { Next } from 'hono';

import type { NestContext } from '#adapter/core/context';
import type { NestRequest, NextHandler, TrustProxy } from '#adapter/core/request/request';

const NOOP_NEXT: NextHandler = () => Promise.resolve();

type Outcome = 'handled' | 'streaming';

const logger = new Logger('SseRoute');

const describe = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

type HonoRouteHandler = (context: NestContext, next: Next) => Promise<Response>;

type NestExceptionHandler = (...args: [unknown, NestRequest, NestContext, NextHandler]) => unknown;

type ExceptionRunner = (error: unknown, context: NestContext) => Promise<Response>;

type StreamInterceptor = (
  context: NestContext,
  status: () => number | undefined,
) => Promise<unknown>;

interface BridgeOptions {
  readonly bodyLimit: () => number | undefined;
  readonly bodyParsingEnabled: () => boolean;
  readonly multipart: () => boolean;
  readonly pendingStatus: (context: NestContext) => number | undefined;
  readonly rawBody: () => boolean;
  readonly trustProxy: () => TrustProxy;
}

export { NOOP_NEXT, describe, logger };
export type {
  BridgeOptions,
  ExceptionRunner,
  HonoRouteHandler,
  NestExceptionHandler,
  Outcome,
  StreamInterceptor,
};

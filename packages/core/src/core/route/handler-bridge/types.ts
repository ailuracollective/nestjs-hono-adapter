import { Logger } from '@nestjs/common';
import type { Next } from 'hono';

import type { NestContext } from '#adapter/core/context';
import type {
  NestRequest,
  NextHandler,
  TrustProxy,
} from '#adapter/core/request/request';

/** The continuation used where there is no pipeline. */
const NOOP_NEXT: NextHandler = () => Promise.resolve();

/** Which of the two things a route handler races settled first. */
type Outcome = 'handled' | 'streaming';

/** Says a handler failed after the stream it started was sent. */
const logger = new Logger('SseRoute');

/** The message of a failure, whatever shape it was thrown in. */
const describe = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** The handler Hono runs for a route Nest registered. */
type HonoRouteHandler = (
  context: NestContext,
  next: Next,
) => Promise<Response>;

/** The handler Nest installs as its global exception layer. */
type NestExceptionHandler = (
  ...args: [unknown, NestRequest, NestContext, NextHandler]
) => unknown;

/** Runs the exception layer for one failed request. */
type ExceptionRunner = (
  error: unknown,
  context: NestContext,
) => Promise<Response>;

/** Installs the surface a handler streams into. */
type StreamInterceptor = (
  context: NestContext,
  status: () => number | undefined,
) => Promise<unknown>;

/** What the bridge reads off the adapter that built it. */
interface BridgeOptions {
  readonly bodyLimit: () => number | undefined;
  readonly bodyParsingEnabled: () => boolean;
  /** Whether the upload island owns multipart bodies. */
  readonly multipart: () => boolean;
  readonly pendingStatus: (
    context: NestContext,
  ) => number | undefined;
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

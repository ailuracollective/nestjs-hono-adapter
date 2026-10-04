import { HttpStatus } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';

import type { NodeEnv } from './context.ts';

/** The answer Nest's own adapters give while shutting down. */
const CLOSING_BODY = {
  message: 'Service Unavailable',
  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
} as const;

/** The answer a request that arrives while closing receives. */
function closingResponse(): Response {
  return Response.json(CLOSING_BODY, {
    status: HttpStatus.SERVICE_UNAVAILABLE,
  });
}

/**
 * Answers the requests that arrive while the server is closing.
 *
 * A request already in flight has passed this step and is left
 * to finish; one that arrives afterwards is refused instead of
 * being accepted and then dropped when the socket goes away.
 * The step does nothing unless the application asked for it.
 */
function closingBridge(
  isClosing: () => boolean,
): MiddlewareHandler<NodeEnv> {
  return (_context, next) => {
    if (isClosing()) {
      return Promise.resolve(closingResponse());
    }
    return next();
  };
}

export { closingBridge };

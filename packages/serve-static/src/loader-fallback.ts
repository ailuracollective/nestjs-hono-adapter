import type {
  NestContext,
  Transport,
} from '@ailura/nestjs-hono-adapter';

import { isRouteExcluded } from './exclude.ts';
import { answerIndex } from './index-file-answer.ts';
import type { IndexRequest } from './index-file-read.ts';
import { underRoot } from './mount-roots.ts';
import type { Handler } from './mount-roots.ts';
import type { Peers } from './peer-shapes.ts';
import type { Resolved } from './loader-resolve.ts';

/** The application one registration is being mounted on. */
interface Mounting {
  /** The Hono application the handlers go on. */
  readonly app: { use: (path: string, fn: Handler) => void };
  /** The peers `@nestjs/serve-static` named. */
  readonly peers: Peers;
  /** The transport that reads the files. */
  readonly transport: Transport;
}

/** Whether a request is one the SPA fallback answers at all. */
const answers = (
  context: NestContext,
  peers: Peers,
  resolved: Resolved,
): boolean => {
  const { method } = context.req;
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  const { pathname } = new URL(context.req.url);
  return (
    underRoot(pathname, resolved.serveRoot) &&
    !isRouteExcluded(peers, pathname, resolved.exclude)
  );
};

/** What the SPA fallback is handed for one answered request. */
const requestOf = (
  context: NestContext,
  mounting: Mounting,
  resolved: Resolved,
): IndexRequest => {
  const { method } = context.req;
  const { pathname } = new URL(context.req.url);
  return {
    clientPath: resolved.clientPath,
    context,
    method,
    pathname,
    peers: mounting.peers,
    transport: mounting.transport,
  };
};

/**
 * Serves the SPA fallback, for the requests the directory
 * misses.
 */
const mountFallback = (
  mounting: Mounting,
  resolved: Resolved,
): void => {
  const answering = (
    context: NestContext,
    next: () => Promise<void>,
  ): Promise<unknown> => {
    const { peers } = mounting;
    if (!answers(context, peers, resolved)) {
      return next();
    }
    return answerIndex(requestOf(context, mounting, resolved));
  };
  mounting.app.use('*', answering);
};

export { mountFallback };
export type { Mounting };

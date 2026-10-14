import type {
  NestContext,
  Transport,
} from '@ailura/nestjs-hono-adapter';

import type { ExceptionShape, Peers } from './peer-shapes.ts';

/** The file a single-page application is answered with. */
const INDEX_FILE = 'index.html';

/** The status a miss is answered with. */
const MISS_STATUS = 404;

/** What the SPA fallback needs to answer one request. */
interface IndexRequest {
  /** The directory the index file is read from. */
  readonly clientPath: string;
  /** The context to answer through. */
  readonly context: NestContext;
  /** The method, for the miss message. */
  readonly method: string;
  /** The peers `@nestjs/serve-static` named. */
  readonly peers: Peers;
  /** The path that was asked for, for the miss message. */
  readonly pathname: string;
  /** The transport that reads files on this runtime. */
  readonly transport: Transport;
}

/**
 * The transport reading one file: every transport reads through
 * `serveStatic`, so no filesystem API is named.
 */
const indexReader =
  (transport: Transport, clientPath: string) =>
  (
    context: NestContext,
    next: () => Promise<void>,
  ): Promise<unknown> =>
    transport.serveStatic({
      index: INDEX_FILE,
      rewriteRequestPath: (): string => INDEX_FILE,
      root: clientPath,
    })(context, next);

/**
 * The message a miss says, exactly as the Express loader says
 * it.
 */
const missMessage = (request: IndexRequest): string =>
  `Cannot ${request.method} ${request.pathname}`;

/** Joins a directory and the index file, without `node:path`. */
const indexPath = (clientPath: string): string =>
  clientPath.endsWith('/')
    ? `${clientPath}${INDEX_FILE}`
    : `${clientPath}/${INDEX_FILE}`;

/** Writes a Nest exception out as the JSON body of a miss. */
const jsonMiss = (
  request: IndexRequest,
  error: ExceptionShape,
): unknown => {
  const { context } = request;
  context.status(MISS_STATUS);
  return context.json(error.getResponse());
};

export { indexPath, indexReader, jsonMiss, missMessage };
export type { IndexRequest };

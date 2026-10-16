import type { NestContext, Transport } from '@ailura/nestjs-hono-adapter';

import type { ExceptionShape, Peers } from './peer-shapes.ts';

const INDEX_FILE = 'index.html';

const MISS_STATUS = 404;

interface IndexRequest {
  readonly clientPath: string;
  readonly context: NestContext;
  readonly method: string;
  readonly peers: Peers;
  readonly pathname: string;
  readonly transport: Transport;
}

/**
 * The transport reading one file: every transport reads through `serveStatic`, so no filesystem API
 * is named.
 */
const indexReader =
  (transport: Transport, clientPath: string) =>
  (context: NestContext, next: () => Promise<void>): Promise<unknown> =>
    transport.serveStatic({
      index: INDEX_FILE,
      rewriteRequestPath: (): string => INDEX_FILE,
      root: clientPath,
    })(context, next);

const missMessage = (request: IndexRequest): string =>
  `Cannot ${request.method} ${request.pathname}`;

const indexPath = (clientPath: string): string =>
  clientPath.endsWith('/') ? `${clientPath}${INDEX_FILE}` : `${clientPath}/${INDEX_FILE}`;

const jsonMiss = (request: IndexRequest, error: ExceptionShape): unknown => {
  const { context } = request;
  context.status(MISS_STATUS);
  return context.json(error.getResponse());
};

export { indexPath, indexReader, jsonMiss, missMessage };
export type { IndexRequest };

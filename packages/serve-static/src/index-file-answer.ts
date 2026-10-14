import {
  indexReader,
  jsonMiss,
  missMessage,
} from './index-file-read.ts';
import type { IndexRequest } from './index-file-read.ts';
import { notFoundException } from './peer-read.ts';

/**
 * The status a miss is answered with, named rather than read
 * off.
 */
const MISS_STATUS = 404;

/** What the index reader is handed when there is no file. */
const noNext = (): Promise<void> => Promise.resolve();

/** The exception constructor a miss is written as. */
interface NestCommon {
  readonly NotFoundException: new (message: string) => {
    getResponse: () => unknown;
  };
}

/** Whether a loaded module carries Nest's not-found exception. */
const isNestCommon = (loaded: unknown): loaded is NestCommon =>
  typeof loaded === 'object' &&
  loaded !== null &&
  'NotFoundException' in loaded;

/** Stands in for a peer that did not resolve at all. */
const ABSENT = Symbol('absent');

/**
 * `@nestjs/common`, or the sentinel when the deployment has
 * none.
 */
const optionalNest = async (): Promise<unknown> => {
  try {
    return await import('@nestjs/common');
  } catch {
    return ABSENT;
  }
};

/** The miss when the peer is absent, so a worker still answers. */
const answerMissingPlain = async (
  request: IndexRequest,
): Promise<unknown> => {
  const nest = await optionalNest();
  if (isNestCommon(nest)) {
    const error = new nest.NotFoundException(
      missMessage(request),
    );
    return jsonMiss(request, error);
  }
  const { context } = request;
  context.status(MISS_STATUS);
  return context.text('Not Found');
};

/**
 * Answers the miss: the peer's exception, or a plain 404,
 * status named rather than read off.
 */
const answerMissing = (
  request: IndexRequest,
): Promise<unknown> => {
  const NotFound = notFoundException(request.peers);
  if (NotFound === undefined) {
    return answerMissingPlain(request);
  }
  const error = new NotFound(missMessage(request));
  return Promise.resolve(jsonMiss(request, error));
};

/** Answers the index file through the transport, or the miss. */
const answerIndex = async (
  request: IndexRequest,
): Promise<unknown> => {
  const { clientPath, context, transport } = request;
  const found = await indexReader(transport, clientPath)(
    context,
    noNext,
  );
  return found === undefined ? answerMissing(request) : found;
};

export { answerIndex };

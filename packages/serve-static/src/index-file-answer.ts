import { indexReader, jsonMiss, missMessage } from './index-file-read.ts';
import type { IndexRequest } from './index-file-read.ts';
import { notFoundException } from './peer-read.ts';

const MISS_STATUS = 404;

const noNext = (): Promise<void> => Promise.resolve();

interface NestCommon {
  readonly NotFoundException: new (message: string) => {
    getResponse: () => unknown;
  };
}

const isNestCommon = (loaded: unknown): loaded is NestCommon =>
  typeof loaded === 'object' && loaded !== null && 'NotFoundException' in loaded;

const ABSENT = Symbol('absent');

const optionalNest = async (): Promise<unknown> => {
  try {
    return await import('@nestjs/common');
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) {
      throw error;
    }
    const code = Reflect.get(error, 'code');
    if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return ABSENT;
  }
};

const answerMissingPlain = async (request: IndexRequest): Promise<unknown> => {
  const nest = await optionalNest();
  if (isNestCommon(nest)) {
    const error = new nest.NotFoundException(missMessage(request));
    return jsonMiss(request, error);
  }
  const { context } = request;
  context.status(MISS_STATUS);
  return context.text('Not Found');
};

const answerMissing = (request: IndexRequest): Promise<unknown> => {
  const NotFound = notFoundException(request.peers);
  if (NotFound === undefined) return answerMissingPlain(request);
  const error = new NotFound(missMessage(request));
  return Promise.resolve(jsonMiss(request, error));
};

const answerIndex = async (request: IndexRequest): Promise<unknown> => {
  const { clientPath, context, transport } = request;
  const found = await indexReader(transport, clientPath)(context, noNext);
  return found === undefined ? answerMissing(request) : found;
};

export { answerIndex };

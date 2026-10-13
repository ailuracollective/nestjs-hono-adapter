import {
  Inject,
  mixin,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  OnModuleInit,
  Type,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { catchError, concatMap, from, of } from 'rxjs';
import type { Observable } from 'rxjs';

import { declareMultipart } from '@ailura/nestjs-hono-adapter-core';
import type {
  NestContext,
  NestRequest,
} from '@ailura/nestjs-hono-adapter-core';
import { MULTIPART_MODULE_OPTIONS } from '../files.constants.ts';
import type {
  MultipartFileStream,
  MultipartModuleOptions,
  MultipartOptions,
  MultipartStorageEngine,
} from '../interfaces/index.ts';
import { WRONG_ADAPTER_MESSAGE } from './multipart.constants.ts';
import {
  processMultipart,
  processStream,
  resolveStorage,
  validateLimits,
} from './multipart.parser.ts';
import type { UploadSpec } from './multipart.parser.ts';
import { mergeOptions } from './multipart.utils.ts';

/**
 * What every upload interceptor shares: the options it merges
 * from the module and its own argument, and the mark that tells
 * the adapter a multipart body is this island's to consume
 * rather than the request path's.
 */
abstract class MultipartInterceptorHost
  implements NestInterceptor, OnModuleInit
{
  protected readonly options: MultipartOptions;
  private readonly adapterHost: HttpAdapterHost | undefined;

  public constructor(
    moduleOptions: MultipartModuleOptions,
    adapterHost: HttpAdapterHost | undefined,
    localOptions: MultipartOptions | undefined,
  ) {
    this.options = mergeOptions(
      moduleOptions,
      localOptions ?? {},
    );
    if (typeof this.options.limits !== 'function') {
      validateLimits(this.options.limits);
    }
    this.adapterHost = adapterHost;
  }

  public onModuleInit(): void {
    const adapter = this.adapterHost?.httpAdapter;
    if (adapter === undefined) {
      return;
    }
    if (adapter.getType() !== 'hono') {
      throw new Error(WRONG_ADAPTER_MESSAGE);
    }
    declareMultipart(adapter);
  }

  public abstract intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>>;
}

/**
 * Builds the interceptor an upload decorator exports. It parses
 * the multipart body before the handler runs, with multer's
 * semantics, as `@nestjs/platform-express` and
 * `@nestjs/platform-fastify` do.
 */
function createMultipartInterceptor(
  spec: UploadSpec,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  class MixinInterceptor extends MultipartInterceptorHost {
    /**
     * Resolved once, as multer resolves it, so a `dest` folder
     * is created at bootstrap rather than on the first upload.
     */
    private readonly storage: MultipartStorageEngine;

    public constructor(
      @Optional()
      @Inject(MULTIPART_MODULE_OPTIONS)
      options: MultipartModuleOptions = {},
      @Optional()
      @Inject(HttpAdapterHost)
      adapterHost?: HttpAdapterHost,
    ) {
      super(options, adapterHost, localOptions);
      this.storage = resolveStorage(this.options);
    }

    public async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const http = context.switchToHttp();
      const request = http.getRequest<NestRequest>();
      const response = http.getResponse<NestContext>();
      await processMultipart(
        response,
        request,
        spec,
        this.options,
        this.storage,
      );
      return next.handle();
    }
  }
  return mixin(MixinInterceptor);
}

/**
 * Whether the answer already reads the upload: a
 * `StreamableFile` built from the very stream the handler was
 * handed drains the body itself while the response is written,
 * so discarding first would take the bytes out from under it.
 */
function keepsUpload(
  result: unknown,
  file: MultipartFileStream | undefined,
): boolean {
  return (
    result instanceof StreamableFile &&
    file !== undefined &&
    result.getStream() === file.stream
  );
}

/** The error to hand on, when what arrived was not one. */
function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/** Discards what the handler left unread, then answers. */
async function afterDrain(
  drain: () => Promise<void>,
  result: unknown,
): Promise<unknown> {
  await drain();
  return result;
}

/** Discards what the handler left unread, then fails. */
async function afterDrainFailure(
  drain: () => Promise<void>,
  error: unknown,
): Promise<never> {
  await drain();
  throw asError(error);
}

/**
 * One answer: passed on when it reads the upload itself, and
 * discarded before it goes out when it does not.
 */
function answer(
  result: unknown,
  file: MultipartFileStream | undefined,
  drain: () => Promise<void>,
): Observable<unknown> {
  if (keepsUpload(result, file)) {
    return of(result);
  }
  return from(afterDrain(drain, result));
}

/**
 * Builds the interceptor a streaming upload decorator exports.
 * It parses a multipart body as far as the file the decorator
 * named and hands it over unread, so the handler can pipe it
 * somewhere instead of holding it, as
 * `@nestjs/platform-fastify` does.
 *
 * Whatever the handler leaves unread is discarded before the
 * answer goes out, as multer discards it: answering while a
 * client is still uploading makes Node.js close the connection
 * under it (EPIPE or ECONNRESET on the client) when it is not
 * kept alive, and leaves a kept-alive one with an unread body.
 * An answer that streams the upload itself is the exception,
 * because it drains the body as it is written; there is a test
 * for each.
 */
function createMultipartStreamInterceptor(
  fieldName: string,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  class MixinInterceptor extends MultipartInterceptorHost {
    public constructor(
      @Optional()
      @Inject(MULTIPART_MODULE_OPTIONS)
      options: MultipartModuleOptions = {},
      @Optional()
      @Inject(HttpAdapterHost)
      adapterHost?: HttpAdapterHost,
    ) {
      super(options, adapterHost, localOptions);
    }

    public async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const http = context.switchToHttp();
      const parsed = await processStream(
        http.getResponse<NestContext>(),
        http.getRequest<NestRequest>(),
        fieldName,
        this.options,
      );
      if (parsed === undefined) {
        return next.handle();
      }
      return next.handle().pipe(
        concatMap((result: unknown) =>
          answer(result, parsed.file, parsed.drain),
        ),
        catchError((error: unknown) =>
          from(afterDrainFailure(parsed.drain, error)),
        ),
      );
    }
  }
  return mixin(MixinInterceptor);
}

export {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
};

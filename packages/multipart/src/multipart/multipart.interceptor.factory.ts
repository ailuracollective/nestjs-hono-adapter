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

import { declareMultipart } from '@ailura/nestjs-hono-adapter';
import type {
  NestContext,
  NestRequest,
} from '@ailura/nestjs-hono-adapter';
import { MULTIPART_MODULE_OPTIONS } from '#multipart/files.constants';
import type {
  MultipartFileStream,
  MultipartModuleOptions,
  MultipartOptions,
  MultipartStorageEngine,
} from '#multipart/interfaces/index';
import { WRONG_ADAPTER_MESSAGE } from './multipart.constants.ts';
import {
  processMultipart,
  processStream,
  resolveStorage,
  validateLimits,
} from './multipart.parser.ts';
import type { UploadSpec } from './multipart.parser.ts';
import { mergeOptions } from './multipart.utils.ts';

/** What every upload interceptor shares. */
abstract class MultipartInterceptorHost
  implements NestInterceptor, OnModuleInit
{
  /** The merged options the interceptor parses with. */
  protected readonly options: MultipartOptions;
  /** The host the HTTP adapter is read from. */
  private readonly adapterHost: HttpAdapterHost | undefined;

  /** Merges the options and keeps the adapter host. */
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

  /** Checks the adapter and declares the multipart island. */
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

  /** Parses the body before the handler runs. */
  public abstract intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>>;
}

/** Builds the interceptor an upload decorator exports. */
const createMultipartInterceptor = (
  spec: UploadSpec,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> => {
  class MixinInterceptor extends MultipartInterceptorHost {
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
};

/** Whether the answer already reads the uploaded stream. */
const keepsUpload = (
  result: unknown,
  file: MultipartFileStream | undefined,
): boolean =>
  result instanceof StreamableFile &&
  file !== undefined &&
  result.getStream() === file.stream;

/** The error to hand on, when what arrived was not one. */
const asError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
};

/** Discards what the handler left unread, then answers. */
const afterDrain = async (
  drain: () => Promise<void>,
  result: unknown,
): Promise<unknown> => {
  await drain();
  return result;
};

/** Discards what the handler left unread, then fails. */
const afterDrainFailure = async (
  drain: () => Promise<void>,
  error: unknown,
): Promise<never> => {
  await drain();
  throw asError(error);
};

/** Passes an answer on, discarding the unread upload first. */
const answer = (
  result: unknown,
  file: MultipartFileStream | undefined,
  drain: () => Promise<void>,
): Observable<unknown> => {
  if (keepsUpload(result, file)) {
    return of(result);
  }
  return from(afterDrain(drain, result));
};

/** Builds the interceptor a streaming upload decorator exports. */
const createMultipartStreamInterceptor = (
  fieldName: string,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> => {
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
};

export {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
};

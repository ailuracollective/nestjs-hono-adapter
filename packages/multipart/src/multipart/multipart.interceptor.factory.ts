import { Inject, mixin, Optional } from '@nestjs/common';
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
import type { NestContext, NestRequest } from '@ailura/nestjs-hono-adapter';
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
import { mergeOptions, isStreamableFile } from './multipart.utils.ts';

abstract class MultipartInterceptorHost implements NestInterceptor, OnModuleInit {
  protected readonly options: MultipartOptions;
  private readonly adapterHost: HttpAdapterHost | undefined;

  public constructor(
    moduleOptions: MultipartModuleOptions,
    adapterHost: HttpAdapterHost | undefined,
    localOptions: MultipartOptions | undefined,
  ) {
    this.options = mergeOptions(moduleOptions, localOptions ?? {});
    if (typeof this.options.limits !== 'function') validateLimits(this.options.limits);
    this.adapterHost = adapterHost;
  }

  public onModuleInit(): void {
    const adapter = this.adapterHost?.httpAdapter;
    if (adapter === undefined) {
      // The host carries a token from another `@nestjs/core` copy.
      declareMultipart();
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
      await processMultipart(response, request, spec, this.options, this.storage);
      return next.handle();
    }
  }
  return mixin(MixinInterceptor);
};

const keepsUpload = (result: unknown, file: MultipartFileStream | undefined): boolean =>
  isStreamableFile(result) && file !== undefined && result.getStream() === file.stream;

const asError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(String(error));
};

const afterDrain = async (drain: () => Promise<void>, result: unknown): Promise<unknown> => {
  await drain();
  return result;
};

const afterDrainFailure = async (drain: () => Promise<void>, error: unknown): Promise<never> => {
  await drain();
  throw asError(error);
};

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
      if (parsed === undefined) return next.handle();
      return next.handle().pipe(
        concatMap((result: unknown) => answer(result, parsed.file, parsed.drain)),
        catchError((error: unknown) => from(afterDrainFailure(parsed.drain, error))),
      );
    }
  }
  return mixin(MixinInterceptor);
};

export { createMultipartInterceptor, createMultipartStreamInterceptor };

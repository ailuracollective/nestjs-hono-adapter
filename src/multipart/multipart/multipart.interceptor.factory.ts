import { Inject, mixin, Optional } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  OnModuleInit,
  Type,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Observable } from 'rxjs';

import type { NestContext } from '../../core/context.ts';
import { declareMultipart } from '../../core/multipart.ts';
import type { NestRequest } from '../../core/request.ts';
import { MULTIPART_MODULE_OPTIONS } from '../files.constants.ts';
import type {
  MultipartModuleOptions,
  MultipartOptions,
  MultipartStorageEngine,
} from '../interfaces/index.ts';
import {
  processMultipart,
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
    if (adapter !== undefined) {
      declareMultipart(adapter);
    }
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

export { createMultipartInterceptor };

import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
} from '#multipart/multipart/multipart.interceptor.factory';

/** Accepts one file in `fieldName`, exposed as `req.file`. */
const FileInterceptor = (
  fieldName: string,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> =>
  createMultipartInterceptor(
    {
      fields: [{ maxCount: 1, name: fieldName }],
      strategy: 'VALUE',
    },
    localOptions,
  );

/**
 * Accepts one file in `fieldName` and hands it over as a live
 * stream.
 */
const FileStreamInterceptor = (
  fieldName: string,
  localOptions?: Omit<MultipartOptions, 'dest' | 'storage'>,
): Type<NestInterceptor> =>
  createMultipartStreamInterceptor(fieldName, localOptions);

export { FileInterceptor, FileStreamInterceptor };

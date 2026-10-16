import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
} from '#multipart/multipart/multipart.interceptor.factory';

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

const FileStreamInterceptor = (
  fieldName: string,
  localOptions?: Omit<MultipartOptions, 'dest' | 'storage'>,
): Type<NestInterceptor> => createMultipartStreamInterceptor(fieldName, localOptions);

export { FileInterceptor, FileStreamInterceptor };

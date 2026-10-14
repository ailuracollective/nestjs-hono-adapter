import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

/** Accepts every file, in any field, as an array in `req.files`. */
const AnyFilesInterceptor = (
  localOptions?: MultipartOptions,
): Type<NestInterceptor> =>
  createMultipartInterceptor(
    { fields: 'ANY', strategy: 'ARRAY' },
    localOptions,
  );

export { AnyFilesInterceptor };

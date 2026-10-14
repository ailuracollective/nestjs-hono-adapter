import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

/**
 * Accepts text fields only; a file fails with
 * `BadRequestException`.
 */
const NoFilesInterceptor = (
  localOptions?: MultipartOptions,
): Type<NestInterceptor> =>
  createMultipartInterceptor(
    { fields: [], strategy: 'NONE' },
    localOptions,
  );

export { NoFilesInterceptor };

import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '../interfaces/index.ts';
import { createMultipartInterceptor } from '../multipart/multipart.interceptor.factory.ts';

/**
 * Accepts text fields only, exposed in `req.body`; any file
 * fails the request with a `BadRequestException`. The
 * counterpart of `@nestjs/platform-express`'s
 * `NoFilesInterceptor`.
 *
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults
 */
function NoFilesInterceptor(
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  return createMultipartInterceptor(
    { fields: [], strategy: 'NONE' },
    localOptions,
  );
}

export { NoFilesInterceptor };

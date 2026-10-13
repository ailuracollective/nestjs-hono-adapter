import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '../interfaces/index.ts';
import { createMultipartInterceptor } from '../multipart/multipart.interceptor.factory.ts';

/**
 * Accepts every file, in any field, and exposes them as an
 * array in `req.files` (`@UploadedFiles()`). The counterpart of
 * `@nestjs/platform-express`'s `AnyFilesInterceptor`.
 *
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults
 */
function AnyFilesInterceptor(
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  return createMultipartInterceptor(
    { fields: 'ANY', strategy: 'ARRAY' },
    localOptions,
  );
}

export { AnyFilesInterceptor };

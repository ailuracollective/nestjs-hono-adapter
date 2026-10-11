import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '../interfaces/index.ts';
import { createMultipartInterceptor } from '../multipart/multipart.interceptor.factory.ts';

/**
 * Accepts up to `maxCount` files in `fieldName` and exposes
 * them as an array in `req.files` (`@UploadedFiles()`). The
 * counterpart of `@nestjs/platform-express`'s
 * `FilesInterceptor`.
 *
 * @param fieldName Name of the form field that carries the
 *   files
 * @param maxCount Most files to accept
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults
 */
function FilesInterceptor(
  fieldName: string,
  maxCount?: number,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  return createMultipartInterceptor(
    {
      fields: [
        {
          name: fieldName,
          ...(maxCount !== undefined && { maxCount }),
        },
      ],
      strategy: 'ARRAY',
    },
    localOptions,
  );
}

export { FilesInterceptor };

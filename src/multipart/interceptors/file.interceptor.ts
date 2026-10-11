import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '../interfaces/index.ts';
import { createMultipartInterceptor } from '../multipart/multipart.interceptor.factory.ts';

/**
 * Accepts one file in `fieldName` and exposes it as `req.file`
 * (`@UploadedFile()`), with the text fields in `req.body`. The
 * counterpart of `@nestjs/platform-express`'s
 * `FileInterceptor`.
 *
 * @param fieldName Name of the form field that carries the file
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults
 */
function FileInterceptor(
  fieldName: string,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  return createMultipartInterceptor(
    {
      fields: [{ maxCount: 1, name: fieldName }],
      strategy: 'VALUE',
    },
    localOptions,
  );
}

export { FileInterceptor };

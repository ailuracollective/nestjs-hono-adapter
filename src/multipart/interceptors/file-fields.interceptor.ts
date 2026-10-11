import type { NestInterceptor, Type } from '@nestjs/common';

import type {
  MultipartField,
  MultipartOptions,
} from '../interfaces/index.ts';
import { createMultipartInterceptor } from '../multipart/multipart.interceptor.factory.ts';

/**
 * Accepts files in each of `uploadFields` and exposes them
 * grouped by field name in `req.files` (`@UploadedFiles()`).
 * The counterpart of `@nestjs/platform-express`'s
 * `FileFieldsInterceptor`.
 *
 * @param uploadFields Accepted fields, each with an optional
 *   `maxCount`
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults
 */
function FileFieldsInterceptor(
  uploadFields: MultipartField[],
  localOptions?: MultipartOptions,
): Type<NestInterceptor> {
  return createMultipartInterceptor(
    { fields: uploadFields, strategy: 'OBJECT' },
    localOptions,
  );
}

export { FileFieldsInterceptor };

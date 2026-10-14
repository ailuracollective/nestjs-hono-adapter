import type { NestInterceptor, Type } from '@nestjs/common';

import type {
  MultipartField,
  MultipartOptions,
} from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

/** Accepts files in the named fields, grouped by field name. */
const FileFieldsInterceptor = (
  uploadFields: MultipartField[],
  localOptions?: MultipartOptions,
): Type<NestInterceptor> =>
  createMultipartInterceptor(
    { fields: uploadFields, strategy: 'OBJECT' },
    localOptions,
  );

export { FileFieldsInterceptor };

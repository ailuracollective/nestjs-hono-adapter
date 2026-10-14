import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

/**
 * Accepts up to `maxCount` files in `fieldName`, as
 * `req.files`.
 */
const FilesInterceptor = (
  fieldName: string,
  maxCount?: number,
  localOptions?: MultipartOptions,
): Type<NestInterceptor> =>
  createMultipartInterceptor(
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

export { FilesInterceptor };

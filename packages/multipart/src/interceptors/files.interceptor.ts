import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

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

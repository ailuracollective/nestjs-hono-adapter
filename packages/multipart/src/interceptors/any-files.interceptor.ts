import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '#multipart/interfaces/index';
import { createMultipartInterceptor } from '#multipart/multipart/multipart.interceptor.factory';

const AnyFilesInterceptor = (localOptions?: MultipartOptions): Type<NestInterceptor> =>
  createMultipartInterceptor({ fields: 'ANY', strategy: 'ARRAY' }, localOptions);

export { AnyFilesInterceptor };

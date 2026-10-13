import type { NestInterceptor, Type } from '@nestjs/common';

import type { MultipartOptions } from '../interfaces/index.ts';
import {
  createMultipartInterceptor,
  createMultipartStreamInterceptor,
} from '../multipart/multipart.interceptor.factory.ts';

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

/**
 * Accepts one file in `fieldName` and hands it to the route
 * handler as a live stream instead of storing it: `req.file` is
 * a `MultipartFileStream`, whose `stream` carries the bytes as
 * they arrive, so a file larger than memory or disk can be
 * piped somewhere. The streaming counterpart of
 * `FileInterceptor`, and the counterpart of
 * `@nestjs/platform-fastify`'s `FileStreamInterceptor`.
 *
 * Only what the handler reads is taken from the client, and
 * whatever it leaves unread is discarded once the handler has
 * answered, so a client that is still uploading is never left
 * hanging. Because the size is not known when the handler runs,
 * `MaxFileSizeValidator` and the magic-number check of
 * `FileTypeValidator` do not apply; `limits.fileSize` is
 * enforced on the stream instead, which errors with a
 * `PayloadTooLargeException` once it is passed.
 *
 * @param fieldName Name of the form field that carries the file
 * @param localOptions Options merged over the `MultipartModule`
 *   defaults, without `dest` or `storage`: nothing is stored
 */
function FileStreamInterceptor(
  fieldName: string,
  localOptions?: Omit<MultipartOptions, 'dest' | 'storage'>,
): Type<NestInterceptor> {
  return createMultipartStreamInterceptor(
    fieldName,
    localOptions,
  );
}

export { FileInterceptor, FileStreamInterceptor };

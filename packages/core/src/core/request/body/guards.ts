import { PayloadTooLargeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

const JSON_TYPE = /^application\/(?:.+\+)?json$/u;

const mediaTypeOf = (contentType: string): string =>
  (contentType.split(';', 1)[0] ?? '').trim().toLowerCase();

const mediaTypeCache = new WeakMap<NestContext, string>();

const mediaType = (context: NestContext): string => {
  const cached = mediaTypeCache.get(context);
  if (cached !== undefined || mediaTypeCache.has(context)) return cached ?? '';
  const parsed = mediaTypeOf(context.req.header('content-type') ?? '');
  mediaTypeCache.set(context, parsed);
  return parsed;
};

// A Web body or the framing headers Express reads; either alone misses a transport it serves.
const declaresBodyCache = new WeakMap<NestContext, boolean>();

const declaresBody = (context: NestContext): boolean => {
  const cached = declaresBodyCache.get(context);
  if (cached !== undefined || declaresBodyCache.has(context)) return cached ?? false;
  const value =
    context.req.raw.body !== null ||
    context.req.raw.bodyUsed ||
    context.req.header('transfer-encoding') !== undefined ||
    context.req.header('content-length') !== undefined;
  declaresBodyCache.set(context, value);
  return value;
};

const assertWithinLength = (context: NestContext, limit: number | undefined): void => {
  if (limit === undefined) return;
  const declared = context.req.header('content-length');
  if (declared === undefined) return;
  const length = Number(declared);
  if (Number.isFinite(length) && length > limit) {
    throw new PayloadTooLargeException();
  }
};

const assertWithinSize = (size: number, limit: number | undefined): void => {
  if (limit !== undefined && size > limit) throw new PayloadTooLargeException();
};

const bounded = (
  body: ReadableStream<Uint8Array>,
  limit: number | undefined,
): ReadableStream<Uint8Array> => {
  let size = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller): void {
        size += chunk.byteLength;
        assertWithinSize(size, limit);
        controller.enqueue(chunk);
      },
    }),
  );
};

export {
  BODYLESS_METHODS,
  JSON_TYPE,
  assertWithinLength,
  assertWithinSize,
  bounded,
  declaresBody,
  mediaType,
  mediaTypeOf,
};

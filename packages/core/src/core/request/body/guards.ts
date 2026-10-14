import { PayloadTooLargeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

const JSON_TYPE = /^application\/(?:.+\+)?json$/u;

const mediaType = (context: NestContext): string => {
  const header = context.req.header('content-type') ?? '';
  return (header.split(';')[0] ?? '').trim().toLowerCase();
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

export { BODYLESS_METHODS, JSON_TYPE, assertWithinLength, assertWithinSize, bounded, mediaType };

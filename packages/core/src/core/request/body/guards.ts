import { PayloadTooLargeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';

/** Methods that never carry a payload. */
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/** The media types that carry a JSON document. */
const JSON_TYPE = /^application\/(?:.+\+)?json$/u;

/** The media type a request declares. */
const mediaType = (context: NestContext): string => {
  const header = context.req.header('content-type') ?? '';
  return (header.split(';')[0] ?? '').trim().toLowerCase();
};

/** Refuses a request whose declared length exceeds the limit. */
const assertWithinLength = (
  context: NestContext,
  limit: number | undefined,
): void => {
  if (limit === undefined) {
    return;
  }
  const declared = context.req.header('content-length');
  if (declared === undefined) {
    return;
  }
  const length = Number(declared);
  if (Number.isFinite(length) && length > limit) {
    throw new PayloadTooLargeException();
  }
};

/** Refuses a body whose size exceeds the limit. */
const assertWithinSize = (
  size: number,
  limit: number | undefined,
): void => {
  if (limit !== undefined && size > limit) {
    throw new PayloadTooLargeException();
  }
};

/** Counts the bytes as they pass and fails past the limit. */
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
  mediaType,
};

import { PayloadTooLargeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import type { Bindings } from '#adapter/core/ports/bindings';

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

// HTTP/1 framing is authoritative on a native carrier; reading the Web body defeats Node's lazy Request.
const nativeHttp1 = (bindings: Bindings | undefined): boolean => {
  if (bindings === undefined) return false;
  if (bindings.outgoing === undefined || bindings.incoming === undefined) return false;
  return bindings.incoming.httpVersionMajor === 1;
};

// A Web body or the framing headers Express reads; either alone misses a transport it serves.
const declaresBody = (context: NestContext): boolean => {
  const { raw } = context.req;
  return (
    context.req.header('transfer-encoding') !== undefined ||
    context.req.header('content-length') !== undefined ||
    raw.bodyUsed ||
    (!nativeHttp1(context.env) && raw.body !== null)
  );
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

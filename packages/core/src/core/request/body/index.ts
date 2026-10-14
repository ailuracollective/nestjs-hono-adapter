import type { NestContext } from '#adapter/core/context';
import { assertIdentity } from '#adapter/core/request/body-encoding';
import {
  BODYLESS_METHODS,
  assertWithinLength,
  mediaType,
} from './guards.ts';
import {
  emptyBody,
  readMultipart,
  readPayload,
} from './readers.ts';
import type { BodyOptions, ParsedBody } from './types.ts';

/** Reads the payload of a request. */
const readBody = (
  context: NestContext,
  options: BodyOptions,
): Promise<ParsedBody> => {
  if (BODYLESS_METHODS.has(context.req.method)) {
    return Promise.resolve(emptyBody());
  }
  const type = mediaType(context);
  assertWithinLength(context, options.bodyLimit);
  assertIdentity(context);
  if (type.startsWith('multipart/form-data')) {
    if (options.skipMultipart === true) {
      return Promise.resolve(emptyBody());
    }
    return readMultipart(context);
  }
  return readPayload(context, type, options);
};

export { readBody };
export { toByteLimit } from './limits.ts';
export type {
  BodyParserOptions,
  ParsedBody,
  SecurityHook,
} from './types.ts';

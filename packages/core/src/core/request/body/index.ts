/* eslint-disable typescript/no-unsafe-type-assertion -- the body of a request is kept under a symbol on the context Hono owns */

import type { NestContext } from '#adapter/core/context';
import { assertIdentity } from '#adapter/core/request/body-encoding';
import { BODYLESS_METHODS, assertWithinLength, mediaType } from './guards.ts';
import { emptyBody, readMultipart, readPayload } from './readers.ts';
import type { BodyOptions, ParsedBody } from './types.ts';

const PARSED = Symbol('parsedBody');

type BodyHolder = Record<symbol, Promise<ParsedBody> | undefined>;

const read = (context: NestContext, options: BodyOptions): Promise<ParsedBody> => {
  if (BODYLESS_METHODS.has(context.req.method)) {
    return Promise.resolve(emptyBody());
  }
  const type = mediaType(context);
  assertWithinLength(context, options.bodyLimit);
  assertIdentity(context);
  if (type.startsWith('multipart/form-data')) {
    if (options.skipMultipart === true) return Promise.resolve(emptyBody());
    return readMultipart(context);
  }
  return readPayload(context, type, options);
};

const readBody = (context: NestContext, options: BodyOptions): Promise<ParsedBody> => {
  const holder = context as unknown as BodyHolder;
  const held = holder[PARSED];
  if (held !== undefined) return held;
  const reading = read(context, options);
  holder[PARSED] = reading;
  return reading;
};

export { readBody };
export { toByteLimit } from './limits.ts';
export type { BodyParserOptions, ParsedBody, SecurityHook } from './types.ts';

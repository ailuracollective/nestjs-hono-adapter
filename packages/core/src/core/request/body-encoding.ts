import { UnsupportedMediaTypeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';

/** The encoding a request declares when it declares none. */
const IDENTITY = 'identity';

/** The charset parameter a `content-type` header may carry. */
const CHARSET = 'charset';

/** The charset a request declares when it declares none. */
const DEFAULT_CHARSET = 'utf8';

/** The charsets this adapter can decode. */
const DECODERS = new Map<
  string,
  'utf-16be' | 'utf-16le' | 'utf8'
>([
  ['utf16be', 'utf-16be'],
  ['utf16le', 'utf-16le'],
  ['utf8', 'utf8'],
]);

/** The value a `content-type` header gives a parameter. */
const headerParameter = (
  header: string,
  looked: string,
): string => {
  for (const part of header.split(';').slice(1)) {
    const pair = part.split('=');
    if ((pair[0] ?? '').trim().toLowerCase() === looked) {
      return (pair[1] ?? '')
        .trim()
        .replaceAll('"', '')
        .toLowerCase();
    }
  }
  return '';
};

/** The charset a textual payload declares, or nothing. */
const charsetOf = (context: NestContext): string =>
  headerParameter(
    context.req.header('content-type') ?? '',
    CHARSET,
  );

/** Refuses a request whose body declares a content encoding. */
const assertIdentity = (context: NestContext): void => {
  const encoding = (
    context.req.header('content-encoding') ?? IDENTITY
  ).toLowerCase();
  if (encoding !== IDENTITY) {
    throw new UnsupportedMediaTypeException(
      `Unsupported content encoding "${encoding}"`,
    );
  }
};

/** Decodes text with its declared charset. */
const textOf = (bytes: Uint8Array, charset: string): string => {
  const decoder = DECODERS.get(
    (charset || DEFAULT_CHARSET)
      .replaceAll('-', '')
      .toLowerCase(),
  );
  try {
    if (decoder !== undefined) {
      return new TextDecoder(decoder).decode(bytes);
    }
  } catch {
    // The runtime may not support every label in the registry.
  }
  throw new UnsupportedMediaTypeException(
    `Unsupported charset "${charset}"`,
  );
};

export { assertIdentity, charsetOf, textOf };

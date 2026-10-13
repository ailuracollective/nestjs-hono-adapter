import { UnsupportedMediaTypeException } from '@nestjs/common';

import type { NestContext } from './context.ts';

/** The encoding a request declares when it declares none. */
const IDENTITY = 'identity';

/** The charset parameter a `content-type` header may carry. */
const CHARSET = 'charset';

/** The charset a request declares when it declares none. */
const DEFAULT_CHARSET = 'utf8';

/**
 * The decoder labels this adapter reads, keyed by charset
 * without dashes: the UTF family `body-parser` admits, and only
 * the part of it this runtime decodes. Anything else is
 * refused.
 */
const DECODERS = new Map<
  string,
  'utf-16be' | 'utf-16le' | 'utf8'
>([
  ['utf16be', 'utf-16be'],
  ['utf16le', 'utf-16le'],
  ['utf8', 'utf8'],
]);

/** The value a `content-type` header gives a parameter. */
function headerParameter(
  header: string,
  looked: string,
): string {
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
}

/** The charset a textual payload declares, or nothing. */
function charsetOf(context: NestContext): string {
  return headerParameter(
    context.req.header('content-type') ?? '',
    CHARSET,
  );
}

/**
 * This adapter reads the bytes as sent. `body-parser` inflates
 * `gzip` and `deflate` before parsing; an encoded body is
 * refused here with the 415 it answers an unsupported encoding
 * with, rather than handed to a parser as if it were the
 * document.
 */
function assertIdentity(context: NestContext): void {
  const encoding = (
    context.req.header('content-encoding') ?? IDENTITY
  ).toLowerCase();
  if (encoding !== IDENTITY) {
    throw new UnsupportedMediaTypeException(
      `Unsupported content encoding "${encoding}"`,
    );
  }
}

/**
 * Decodes text with its declared charset, refused with the 415
 * `body-parser` answers one it does not read with. The label is
 * matched without its dashes, so `utf-8` and `utf8` are the
 * same charset, and only the family this runtime decodes is
 * read.
 */
function textOf(bytes: Uint8Array, charset: string): string {
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
}

export { assertIdentity, charsetOf, textOf };

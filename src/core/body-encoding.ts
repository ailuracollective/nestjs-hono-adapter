import { UnsupportedMediaTypeException } from '@nestjs/common';

import type { NestContext } from './context.ts';

/** The encoding a request declares when it declares none. */
const IDENTITY = 'identity';

/** The charset parameter a `content-type` header may carry. */
const CHARSET = 'charset';

/** The charset a request declares when it declares none. */
const DEFAULT_CHARSET = 'utf8';

/**
 * The decoders this adapter reads, keyed by the label without
 * its dashes: the UTF family `body-parser` admits, and only the
 * part of it this runtime decodes. Anything else is refused.
 */
const DECODERS = new Map<string, TextDecoder>([
  ['utf16be', new TextDecoder('utf-16be')],
  ['utf16le', new TextDecoder('utf-16le')],
  ['utf8', new TextDecoder()],
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
 * The exception a charset that cannot be decoded is answered
 * with.
 */
function unsupportedCharset(
  charset: string,
): UnsupportedMediaTypeException {
  return new UnsupportedMediaTypeException(
    `Unsupported charset "${charset}"`,
  );
}

/**
 * The decoder a declared charset names, refused with the 415
 * `body-parser` answers one it does not read with. The label is
 * matched without its dashes, so `utf-8` and `utf8` are the
 * same charset, and only the family this runtime decodes is
 * read.
 */
function decoderFor(charset: string): TextDecoder {
  let label = charset;
  if (label === '') {
    label = DEFAULT_CHARSET;
  }
  const decoder = DECODERS.get(
    label.replaceAll('-', '').toLowerCase(),
  );
  if (decoder === undefined) {
    throw unsupportedCharset(charset);
  }
  return decoder;
}

/** Decodes text with the charset its request declared. */
function textOf(bytes: Uint8Array, charset: string): string {
  return decoderFor(charset).decode(bytes);
}

export { assertIdentity, charsetOf, textOf };

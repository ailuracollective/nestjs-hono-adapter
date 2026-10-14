import { UnsupportedMediaTypeException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';

const IDENTITY = 'identity';

const CHARSET = 'charset';

const DEFAULT_CHARSET = 'utf8';

const DECODERS = new Map<string, 'utf-16be' | 'utf-16le' | 'utf8'>([
  ['utf16be', 'utf-16be'],
  ['utf16le', 'utf-16le'],
  ['utf8', 'utf8'],
]);

const headerParameter = (header: string, looked: string): string => {
  for (const part of header.split(';').slice(1)) {
    const pair = part.split('=');
    if ((pair[0] ?? '').trim().toLowerCase() === looked) {
      return (pair[1] ?? '').trim().replaceAll('"', '').toLowerCase();
    }
  }
  return '';
};

const charsetOf = (context: NestContext): string =>
  headerParameter(context.req.header('content-type') ?? '', CHARSET);

const assertIdentity = (context: NestContext): void => {
  const encoding = (context.req.header('content-encoding') ?? IDENTITY).toLowerCase();
  if (encoding !== IDENTITY) {
    throw new UnsupportedMediaTypeException(`Unsupported content encoding "${encoding}"`);
  }
};

const textOf = (bytes: Uint8Array, charset: string): string => {
  const decoder = DECODERS.get((charset || DEFAULT_CHARSET).replaceAll('-', '').toLowerCase());
  try {
    if (decoder !== undefined) return new TextDecoder(decoder).decode(bytes);
  } catch {
    // The runtime may not support every label in the registry.
  }
  throw new UnsupportedMediaTypeException(`Unsupported charset "${charset}"`);
};

export { assertIdentity, charsetOf, textOf };

import { createHash } from 'node:crypto';

// Express's `etag` setting: `false` turns it off, `true` means weak (Express's default) and the two
// names pick a mode.
type EtagMode = 'strong' | 'weak';

const LEADING_WEAK = /^W\//u;

// The `etag` package Express uses keeps the first 27 base64 characters of the sha1 digest, with the
// body length in hex in front of it.
const DIGEST_LENGTH = 27;

const HEX_RADIX = 16;

const encoder = new TextEncoder();

const bytesOf = (body: unknown): Uint8Array | undefined => {
  // A stream has no tag, exactly as in Express, and neither has an absent body.
  if (body === undefined || body === null || body instanceof ReadableStream) return undefined;
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body === 'object' && typeof Reflect.get(body, 'getStream') === 'function')
    return undefined;
  if (typeof body === 'string') return encoder.encode(body);
  if (typeof body === 'number' || typeof body === 'boolean' || typeof body === 'bigint')
    return encoder.encode(String(body));
  return encoder.encode(JSON.stringify(body));
};

const toEtagMode = (value: unknown): EtagMode | false => {
  if (value === false) return false;
  if (value === true) return 'weak';
  if (value === 'weak' || value === 'strong') return value;
  throw new TypeError('set("etag") takes false, "weak" or "strong".');
};

/**
 * The tag Express would answer with: the length in hex, a dash, and a truncated sha1 of the body
 * (the `etag` package's entity tag), quoted — prefixed `W/` when the setting asks for a weak one.
 */
const etagFor = (body: unknown, mode: EtagMode): string | undefined => {
  const bytes = bytesOf(body);
  if (bytes === undefined) return undefined;
  const digest = createHash('sha1').update(bytes).digest('base64').slice(0, DIGEST_LENGTH);
  const tag = `"${bytes.byteLength.toString(HEX_RADIX)}-${digest}"`;
  if (mode === 'weak') return `W/${tag}`;
  return tag;
};

// Express compares with `fresh`, which ignores the weakness of either side.
const isFresh = (ifNoneMatch: string | undefined, tag: string): boolean => {
  if (ifNoneMatch === undefined) return false;
  if (ifNoneMatch === '*') return true;
  const wanted = tag.replace(LEADING_WEAK, '');
  return ifNoneMatch.split(',').some((entry) => entry.trim().replace(LEADING_WEAK, '') === wanted);
};

export { etagFor, isFresh, toEtagMode };
export type { EtagMode };

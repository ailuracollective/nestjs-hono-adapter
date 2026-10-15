import { createHash } from 'node:crypto';

// Express's `etag` setting: `false` turns it off, `true` means weak (Express's default) and the two
// names pick a mode.
type EtagMode = 'strong' | 'weak';

// The empty body has a fixed tag in the `etag` package Express uses, and clients see it.
const EMPTY_TAG = '0-2jmj7l5rSw0yVb/vlWAYkK/YBwk';

// Express's etag package keeps the first 27 base64 characters of the sha1 digest.
const DIGEST_LENGTH = 27;

const HEX_RADIX = 16;

const LEADING_WEAK = /^W\//u;

const isBinary = (value: unknown): value is Uint8Array | ArrayBuffer =>
  value instanceof Uint8Array || value instanceof ArrayBuffer;

const isStream = (value: unknown): boolean =>
  value instanceof ReadableStream ||
  (typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'getStream') === 'function');

const bytesOf = (body: unknown): Uint8Array | undefined => {
  if (body === undefined || body === null || isStream(body)) return undefined;
  if (isBinary(body)) return body instanceof Uint8Array ? body : new Uint8Array(body);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (typeof body === 'number' || typeof body === 'boolean' || typeof body === 'bigint')
    return new TextEncoder().encode(String(body));
  return new TextEncoder().encode(JSON.stringify(body));
};

const toEtagMode = (value: unknown): EtagMode | false => {
  if (value === false) return false;
  if (value === true) return 'weak';
  if (value === 'weak' || value === 'strong') return value;
  throw new TypeError('set("etag") takes false, "weak" or "strong".');
};

const tagFor = (bytes: Uint8Array): string => {
  if (bytes.byteLength === 0) return EMPTY_TAG;
  const digest = createHash('sha1').update(bytes).digest('base64').slice(0, DIGEST_LENGTH);
  return `${bytes.byteLength.toString(HEX_RADIX)}-${digest}`;
};

/**
 * The tag Express would answer with: the length in hex, a dash, and a truncated sha1 of the body
 * (the `etag` package's entity tag), quoted — and prefixed `W/` when the setting asks for a weak
 * one. A streamed body has no tag, exactly as in Express.
 */
const etagFor = (body: unknown, mode: EtagMode): string | undefined => {
  const bytes = bytesOf(body);
  if (bytes === undefined) return undefined;
  const tag = `"${tagFor(bytes)}"`;
  if (mode === 'weak') return `W/${tag}`;
  return tag;
};

const unquoted = (value: string): string =>
  value.startsWith('W/') ? value.replace(LEADING_WEAK, '') : value;

// Express compares with `fresh`, which ignores the weakness of either side.
const isFresh = (ifNoneMatch: string | undefined, tag: string): boolean => {
  if (ifNoneMatch === undefined) return false;
  if (ifNoneMatch === '*') return true;
  const wanted = unquoted(tag);
  return ifNoneMatch.split(',').some((entry) => unquoted(entry.trim()) === wanted);
};

export { EMPTY_TAG, etagFor, isFresh, toEtagMode };
export type { EtagMode };

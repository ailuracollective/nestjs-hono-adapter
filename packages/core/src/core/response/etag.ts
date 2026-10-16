// Express's `etag` setting: `false` turns it off, `true` means weak (Express's default) and the two
// names pick a mode.
type EtagMode = 'strong' | 'weak';

const LEADING_WEAK = /^W\//u;

const encoder = new TextEncoder();

// The frozen builtin set carries no hash and an entity tag is opaque, so the adapter mixes the
// body's bytes itself: a multiplicative 32-bit hash, which needs no bitwise operator.
const HASH_PRIME = 16_777_619;

const HEX_RADIX = 16;

const digestOf = (bytes: Uint8Array): string => {
  let hash = 0;
  for (const byte of bytes) {
    hash = Math.imul(hash, HASH_PRIME) + byte;
  }
  return Math.abs(hash).toString(HEX_RADIX);
};

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
 * The tag Express's shape would answer with: the body length in hex, a dash, and the digest of the
 * body, quoted — prefixed `W/` when the setting asks for a weak one.
 */
const etagFor = (body: unknown, mode: EtagMode): string | undefined => {
  const bytes = bytesOf(body);
  if (bytes === undefined) return undefined;
  const tag = `"${bytes.byteLength.toString(HEX_RADIX)}-${digestOf(bytes)}"`;
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

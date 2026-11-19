import type { NestContext } from '#adapter/core/context';

import { clearedOptions, writeCookie } from './cookies.ts';
import type { CookieOptions } from './cookies.ts';

const HONO_HEADER_STORAGE = Symbol('storedResponseHeader');

// Node answers `set-cookie` as a list and every other header as a string; `Headers.get` joins the
// cookies with commas, and no client can split them back.
const headerValue = (
  context: NestContext,
  name: string,
): string | readonly string[] | undefined => {
  const { headers } = context.res;
  if (name.toLowerCase() !== 'set-cookie') return headers.get(name) ?? undefined;

  const cookies = headers.getSetCookie();
  return cookies.length === 0 ? undefined : cookies;
};

// Node's `setHeader`: a string replaces what was there, an array is the whole set (an empty one
// removes the header) and only its entries are appended. `docs/compatibility.md` has the rest.
const setHeaderValue = (
  context: NestContext,
  name: string,
  value: number | string | readonly string[],
): void => {
  if (typeof value !== 'object') {
    context.header(name, String(value));
    return;
  }
  context.res.headers.delete(name);
  for (const entry of value) context.header(name, entry, { append: true });
};

function expressHeader(
  this: NestContext,
  field: string | Record<string, string>,
  ...args: [value?: string, options?: { append?: boolean }]
): NestContext {
  const [value, options] = args;
  const honoHeader: unknown = Reflect.get(this, HONO_HEADER_STORAGE);
  if (typeof honoHeader !== 'function') throw new TypeError('Hono header is not installed.');
  if (typeof field === 'object') {
    for (const [name, entry] of Object.entries(field)) {
      honoHeader.call(this, name, entry);
    }
    return this;
  }
  honoHeader.call(this, field, value, options);
  return this;
}

const EXTRAS = {
  clearCookie(this: NestContext, name: string, options?: CookieOptions): NestContext {
    writeCookie(this, { name, options: clearedOptions(options), value: '' });
    return this;
  },
  cookie(
    this: NestContext,
    ...args: [name: string, value: unknown, options?: CookieOptions]
  ): NestContext {
    const [name, value, options] = args;
    writeCookie(this, { name, options, value });
    return this;
  },
  getHeader(this: NestContext, name: string): string | readonly string[] | undefined {
    return headerValue(this, name);
  },
  header: expressHeader,
  removeHeader(this: NestContext, name: string): NestContext {
    this.res.headers.delete(name);
    return this;
  },
  setHeader(
    this: NestContext,
    name: string,
    value: number | string | readonly string[],
  ): NestContext {
    setHeaderValue(this, name, value);
    return this;
  },
};

// Shared methods keep request state on the receiver, never on Hono's prototype.
const fitExtras = (context: NestContext): void => {
  Object.assign(context, EXTRAS);
};

export { HONO_HEADER_STORAGE, fitExtras, headerValue, setHeaderValue };

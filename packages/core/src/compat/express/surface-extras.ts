import type { NestContext } from '#adapter/core/context';

import { clearedOptions, writeCookie } from './cookies.ts';
import type { CookieOptions } from './cookies.ts';

const COOKIE_HEADER = 'set-cookie';

// The Express response members beyond `send`/`type`/`set` (see `docs/compatibility.md`).
const fitExtras = (context: NestContext): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted surface layers the Express response dialect onto the Hono context.
  const target = context as unknown as Record<string, unknown>;
  const honoHeader = context.header;
  // Express's `res.header` is an alias of `res.set`, so it takes an object too; Hono's own `header`
  // — which the adapter calls with its append option — is the one underneath.
  target.header = (
    field: string | Record<string, string>,
    value?: string,
    options?: { append?: boolean },
  ): NestContext => {
    if (typeof field === 'object') {
      for (const [name, entry] of Object.entries(field)) honoHeader.call(context, name, entry);
      return context;
    }
    honoHeader.call(context, field, value, options);
    return context;
  };
  target.setHeader = (name: string, value: string | readonly string[]): NestContext => {
    if (typeof value === 'string') {
      context.header(name, value);
      return context;
    }
    // Node replaces what was there: an array replaces the values (an empty one removes the header),
    // and only the entries of the new array are appended.
    context.res.headers.delete(name);
    for (const entry of value) context.header(name, entry, { append: true });
    return context;
  };
  target.getHeader = (name: string): string | readonly string[] | undefined =>
    headerValue(context, name);
  target.removeHeader = (name: string): NestContext => {
    context.res.headers.delete(name);
    return context;
  };
  target.cookie = (name: string, value: unknown, options?: CookieOptions): NestContext => {
    writeCookie(context, { name, options, value });
    return context;
  };
  target.clearCookie = (name: string, options?: CookieOptions): NestContext => {
    writeCookie(context, { name, options: clearedOptions(options), value: '' });
    return context;
  };
};

// Node answers `set-cookie` as a list and every other header as a string; `Headers.get` joins the
// cookies with commas, and no client can split them back.
const headerValue = (
  context: NestContext,
  name: string,
): string | readonly string[] | undefined => {
  const { headers } = context.res;
  if (name.toLowerCase() !== COOKIE_HEADER) return headers.get(name) ?? undefined;

  const cookies = headers.getSetCookie();
  return cookies.length === 0 ? undefined : cookies;
};

export { fitExtras, headerValue };

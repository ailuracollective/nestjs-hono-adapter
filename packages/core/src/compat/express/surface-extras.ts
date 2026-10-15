import type { NestContext } from '#adapter/core/context';

import { clearedOptions, writeCookie } from './cookies.ts';
import type { CookieOptions } from './cookies.ts';

/**
 * The rest of the Express response dialect: the Node header members a `@Res()` object is reached
 * through (`setHeader`/`getHeader`/`removeHeader`) and Express's `cookie`/`clearCookie`. Kept apart
 * from `surface.ts` only because a `compat/` file may not exceed a hundred lines; it is the same
 * surface, fitted by the same `fitResponse`.
 */
const fitExtras = (context: NestContext): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted surface layers the Express response dialect onto the Hono context.
  const target = context as unknown as Record<string, unknown>;
  target.setHeader = (name: string, value: string | readonly string[]): NestContext => {
    if (typeof value === 'string') context.header(name, value);
    else for (const entry of value) context.header(name, entry, { append: true });
    return context;
  };
  target.getHeader = (name: string): string | undefined =>
    context.res.headers.get(name) ?? undefined;
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

export { fitExtras };

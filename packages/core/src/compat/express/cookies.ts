import type { NestContext } from '#adapter/core/context';

interface CookieOptions {
  readonly domain?: string | undefined;
  readonly expires?: Date | undefined;
  readonly httpOnly?: boolean | undefined;
  readonly maxAge?: number | undefined;
  readonly path?: string | undefined;
  readonly sameSite?: 'lax' | 'none' | 'strict' | boolean | undefined;
  readonly secure?: boolean | undefined;
  readonly signed?: boolean | undefined;
}

interface CookieSpec {
  readonly name: string;
  readonly options: CookieOptions | undefined;
  readonly value: unknown;
}

const MILLISECONDS_PER_SECOND = 1000;

/** The HTTP token characters a cookie name may use. */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

const sameSiteAttribute = (value: CookieOptions['sameSite']): string | undefined => {
  if (value === true) return 'SameSite=Strict';
  if (value === false || value === undefined) return undefined;
  return `SameSite=${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

/** Express's `res.cookie` attribute order, and the `cookie` package's default `Path=/`. */
const attributesOf = (options: CookieOptions): string[] =>
  [
    options.maxAge === undefined
      ? undefined
      : `Max-Age=${Math.floor(options.maxAge / MILLISECONDS_PER_SECOND)}`,
    options.domain === undefined ? undefined : `Domain=${options.domain}`,
    `Path=${options.path ?? '/'}`,
    options.expires === undefined ? undefined : `Expires=${options.expires.toUTCString()}`,
    options.httpOnly === true ? 'HttpOnly' : undefined,
    options.secure === true ? 'Secure' : undefined,
    sameSiteAttribute(options.sameSite),
  ].filter((part): part is string => part !== undefined);

const valueOf = (value: unknown): string =>
  typeof value === 'object' && value !== null ? `j:${JSON.stringify(value)}` : String(value);

const writeCookie = (context: NestContext, spec: CookieSpec): void => {
  if (!TOKEN.test(spec.name)) throw new TypeError('argument name is invalid');
  const options = spec.options ?? {};
  // A `signed` cookie is written unsigned: signing needs an HMAC, and `compat/` carries no Node
  // builtins. A deployment that requires signed cookies signs before calling `res.cookie`.
  const parts = [
    `${spec.name}=${encodeURIComponent(valueOf(spec.value))}`,
    ...attributesOf(options),
  ];
  context.header('Set-Cookie', parts.join('; '), { append: true });
};

const clearedOptions = (options: CookieOptions | undefined): CookieOptions => {
  const held = options ?? {};
  return {
    domain: held.domain,
    expires: new Date(1),
    httpOnly: held.httpOnly,
    path: held.path,
    sameSite: held.sameSite,
    secure: held.secure,
    signed: false,
  };
};

export { clearedOptions, writeCookie };
export type { CookieOptions, CookieSpec };

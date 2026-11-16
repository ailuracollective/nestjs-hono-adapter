import type { Type } from '@nestjs/common';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.middleware');

interface RequestShape {
  readonly headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}

interface MiddlewarePeer {
  readonly InertiaMiddleware: Type<unknown>;
}

const MISSING = -1;

const parseCookie = (part: string): [name: string, value: string] | undefined => {
  const index = part.indexOf('=');
  if (index === MISSING) return undefined;
  const name = part.slice(0, index).trim();
  if (name === '') return undefined;
  const raw = part.slice(index + 1).trim();
  try {
    return [name, decodeURIComponent(raw)];
  } catch {
    return [name, raw];
  }
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  if (header === undefined) return out;
  for (const part of header.split(';')) {
    const pair = parseCookie(part);
    if (pair !== undefined) {
      const [name, value] = pair;
      out[name] = value;
    }
  }
  return out;
};

const cookieHeader = (req: RequestShape): string | undefined => {
  const { headers } = req;
  if (headers === undefined) return undefined;
  const { Cookie, cookie } = headers;
  const value = cookie ?? Cookie;
  if (Array.isArray(value)) return value[0];
  return value;
};

/**
 * The CSRF guard reads `req.cookies`, which Express's cookie parser populates. Hono has no such
 * middleware, so parse the cookie header before the stock Inertia middleware runs.
 */
const patchInertiaMiddleware = (peer: MiddlewarePeer): void => {
  const prototype: unknown = Reflect.get(peer.InertiaMiddleware, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) return;
  if (Reflect.get(prototype, PATCHED) === true) return;
  Reflect.set(prototype, PATCHED, true);

  const original: unknown = Reflect.get(prototype, 'use');
  if (typeof original !== 'function') return;
  Reflect.set(
    prototype,
    'use',
    function use(this: unknown, ...args: [RequestShape, unknown, () => void]): void {
      const [req] = args;
      req.cookies ??= parseCookies(cookieHeader(req));
      Reflect.apply(original, this, args);
    },
  );
};

export { patchInertiaMiddleware };

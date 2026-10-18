import { describe, expect, test } from 'bun:test';

import { clearedOptions, writeCookie } from '#adapter/compat/express/cookies';
import type { NestContext } from '#adapter/core/context';

type CookieContext = NestContext & { headers: Headers };

const contextWithHeaders = (): CookieContext => {
  const headers = new Headers();
  const context = {
    header: (name: string, value: string, options?: { append?: boolean }): void => {
      const { append } = options ?? {};
      if (append === true) {
        headers.append(name, value);
      } else {
        headers.set(name, value);
      }
    },
    headers,
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double carries the Hono header function the cookie writer reads back.
  return context as unknown as CookieContext;
};

describe('writeCookie values', () => {
  test('writes a simple cookie with defaults', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'session', options: undefined, value: 'abc' });
    expect(context.headers.get('set-cookie')).toBe('session=abc; Path=/');
  });

  test('writes a cookie with all options', () => {
    const context = contextWithHeaders();
    const expires = new Date('2025-01-01T00:00:00Z');
    writeCookie(context, {
      name: 'theme',
      options: {
        domain: 'example.com',
        expires,
        httpOnly: true,
        maxAge: 3600,
        path: '/app',
        sameSite: 'lax',
        secure: true,
      },
      value: 'dark',
    });
    expect(context.headers.get('set-cookie')).toBe(
      'theme=dark; Max-Age=3; Domain=example.com; Path=/app; Expires=Wed, 01 Jan 2025 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    );
  });
});

describe('writeCookie sameSite', () => {
  test('writes a cookie with sameSite strict', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: { sameSite: 'strict' }, value: '1' });
    expect(context.headers.get('set-cookie')).toContain('SameSite=Strict');
  });

  test('writes a cookie with sameSite none', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: { sameSite: 'none' }, value: '1' });
    expect(context.headers.get('set-cookie')).toContain('SameSite=None');
  });

  test('writes a cookie with sameSite true as Strict', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: { sameSite: true }, value: '1' });
    expect(context.headers.get('set-cookie')).toContain('SameSite=Strict');
  });

  test('writes a cookie with sameSite false without SameSite', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: { sameSite: false }, value: '1' });
    expect(context.headers.get('set-cookie')).not.toContain('SameSite');
  });
});

describe('writeCookie serialization', () => {
  test('writes a cookie with sameSite undefined without SameSite', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: { sameSite: undefined }, value: '1' });
    expect(context.headers.get('set-cookie')).not.toContain('SameSite');
  });

  test('serializes object values with j: prefix', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'prefs', options: undefined, value: { theme: 'dark' } });
    expect(context.headers.get('set-cookie')).toBe(
      'prefs=j%3A%7B%22theme%22%3A%22dark%22%7D; Path=/',
    );
  });

  test('serializes number values as strings', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'count', options: undefined, value: 42 });
    expect(context.headers.get('set-cookie')).toBe('count=42; Path=/');
  });

  test('appends multiple cookies', () => {
    const context = contextWithHeaders();
    writeCookie(context, { name: 'a', options: undefined, value: '1' });
    writeCookie(context, { name: 'b', options: undefined, value: '2' });
    const cookies = context.headers.getSetCookie();
    expect(cookies).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });
});

describe('writeCookie throws', () => {
  test('throws on invalid cookie name', () => {
    const context = contextWithHeaders();
    expect((): void => {
      writeCookie(context, { name: 'invalid name', options: undefined, value: '1' });
    }).toThrow(TypeError);
  });

  test('throws on cookie name with special characters', () => {
    const context = contextWithHeaders();
    expect((): void => {
      writeCookie(context, { name: 'a@b', options: undefined, value: '1' });
    }).toThrow(TypeError);
  });
});

describe('clearedOptions', () => {
  test('returns default cleared options when handed an empty object', () => {
    const options = clearedOptions({});
    expect(options.expires).toEqual(new Date(1));
    expect(options.signed).toBe(false);
  });

  test('preserves domain from original options', () => {
    const options = clearedOptions({ domain: 'example.com' });
    expect(options.domain).toBe('example.com');
  });

  test('preserves httpOnly from original options', () => {
    const options = clearedOptions({ httpOnly: true });
    expect(options.httpOnly).toBe(true);
  });

  test('preserves path from original options', () => {
    const options = clearedOptions({ path: '/app' });
    expect(options.path).toBe('/app');
  });

  test('preserves sameSite from original options', () => {
    const options = clearedOptions({ sameSite: 'lax' });
    expect(options.sameSite).toBe('lax');
  });

  test('preserves secure from original options', () => {
    const options = clearedOptions({ secure: true });
    expect(options.secure).toBe(true);
  });

  test('always sets signed to false', () => {
    const options = clearedOptions({ signed: true });
    expect(options.signed).toBe(false);
  });

  test('always sets expires to epoch', () => {
    const options = clearedOptions({ expires: new Date('2025-01-01') });
    expect(options.expires).toEqual(new Date(1));
  });
});

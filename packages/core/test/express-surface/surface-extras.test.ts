import { describe, expect, test } from 'bun:test';

import {
  fitExtras,
  headerValue,
  HONO_HEADER_STORAGE,
  setHeaderValue,
} from '#adapter/compat/express/surface-extras';
import type { NestContext } from '#adapter/core/context';

interface TestContext {
  header: (name: string, value: string, opts?: { append?: boolean }) => TestContext;
  res: { headers: Headers; status: number };
}

interface ExtrasSurface {
  clearCookie: (name: string) => void;
  cookie: (name: string, value: string) => void;
  getHeader: (name: string) => string;
  header: (name: string, value: string, opts?: { append?: boolean }) => TestContext;
  removeHeader: (name: string) => void;
  setHeader: (name: string, value: string) => void;
}

const makeContext = (): TestContext => {
  const headers = new Headers();
  const ctx: TestContext = {
    header(name, value, opts) {
      const { append } = opts ?? {};
      if (append === true) headers.append(name, value);
      else headers.set(name, value);
      return ctx;
    },
    res: { headers, status: 220 },
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the storage symbol keys the header function the fitted surface reads back.
  (ctx as unknown as Record<symbol, unknown>)[HONO_HEADER_STORAGE] = ctx.header;
  return ctx;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double stands in for the Hono context the adapter hands the fitted surface.
const asContext = (ctx: TestContext): NestContext => ctx as unknown as NestContext;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fitExtras layers the Express response members onto the Hono context.
const surfaceOf = (ctx: TestContext): ExtrasSurface => ctx as unknown as ExtrasSurface;

describe('headerValue', () => {
  test('returns undefined for missing header', () => {
    const ctx = makeContext();
    expect(headerValue(asContext(ctx), 'x-missing')).toBeUndefined();
  });

  test('returns string value for non-set-cookie headers', () => {
    const ctx = makeContext();
    ctx.header('x-custom', 'value');
    expect(headerValue(asContext(ctx), 'x-custom')).toBe('value');
  });

  test('returns array for set-cookie headers', () => {
    const ctx = makeContext();
    ctx.header('set-cookie', 'a=1', { append: true });
    ctx.header('set-cookie', 'b=2', { append: true });
    const result = headerValue(asContext(ctx), 'set-cookie');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['a=1', 'b=2']);
  });

  test('returns undefined when set-cookie is empty', () => {
    const ctx = makeContext();
    expect(headerValue(asContext(ctx), 'set-cookie')).toBeUndefined();
  });
});

describe('setHeaderValue', () => {
  test('sets a string value', () => {
    const ctx = makeContext();
    setHeaderValue(asContext(ctx), 'x-custom', 'value');
    expect(ctx.res.headers.get('x-custom')).toBe('value');
  });

  test('replaces existing header with string value', () => {
    const ctx = makeContext();
    ctx.header('x-custom', 'old');
    setHeaderValue(asContext(ctx), 'x-custom', 'new');
    expect(ctx.res.headers.get('x-custom')).toBe('new');
  });

  test('sets multiple values from an array', () => {
    const ctx = makeContext();
    setHeaderValue(asContext(ctx), 'x-multi', ['a', 'b']);
    expect(ctx.res.headers.get('x-multi')).toBe('a, b');
  });

  test('removes header when set to empty array', () => {
    const ctx = makeContext();
    ctx.header('x-gone', 'old');
    setHeaderValue(asContext(ctx), 'x-gone', []);
    expect(ctx.res.headers.has('x-gone')).toBe(false);
  });
});

describe('fitExtras members', () => {
  test('sets header method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).header).toBeDefined();
  });

  test('sets setHeader method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).setHeader).toBeDefined();
  });

  test('sets getHeader method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).getHeader).toBeDefined();
  });

  test('sets removeHeader method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).removeHeader).toBeDefined();
  });

  test('sets cookie method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).cookie).toBeDefined();
  });

  test('sets clearCookie method on context', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    expect(surfaceOf(ctx).clearCookie).toBeDefined();
  });
});

describe('fitExtras behaviour', () => {
  test('cookie method writes a Set-Cookie header', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    surfaceOf(ctx).cookie('session', 'abc');
    expect(ctx.res.headers.get('set-cookie')).toContain('session=abc');
  });

  test('clearCookie method writes an expired Set-Cookie header', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    surfaceOf(ctx).clearCookie('session');
    expect(ctx.res.headers.get('set-cookie')).toContain('session=');
  });

  test('setHeader method sets a header', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    surfaceOf(ctx).setHeader('x-custom', 'value');
    expect(ctx.res.headers.get('x-custom')).toBe('value');
  });

  test('getHeader method reads a header', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    ctx.header('x-custom', 'value');
    expect(surfaceOf(ctx).getHeader('x-custom')).toBe('value');
  });

  test('removeHeader method removes a header', () => {
    const ctx = makeContext();
    fitExtras(asContext(ctx));
    ctx.header('x-gone', 'old');
    surfaceOf(ctx).removeHeader('x-gone');
    expect(ctx.res.headers.has('x-gone')).toBe(false);
  });
});

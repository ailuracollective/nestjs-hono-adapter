import { describe, expect, test } from 'bun:test';

import { middlewareResponse } from '#adapter/compat/express/middleware-response';
import type { NestContext } from '#adapter/core/context';

interface TestContext {
  header: (name: string, value: string, opts?: { append?: boolean }) => TestContext;
  res: { headers: Headers; status: number };
  finalized: boolean;
  status: (code: number) => TestContext;
}

interface ProxySurface {
  addListener: (event: string, listener: () => void) => unknown;
  appendHeader: (name: string, value: string) => void;
  end: (body?: unknown) => void;
  getHeader: (name: string) => string;
  hasHeader: (name: string) => boolean;
  headersSent: boolean;
  off: (event: string, listener: () => void) => unknown;
  on: (event: string, listener: () => void) => unknown;
  once: (event: string, listener: () => void) => unknown;
  removeHeader: (name: string) => void;
  removeListener: (event: string, listener: () => void) => unknown;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
  write: (chunk: unknown) => boolean;
  writeHead: (status?: number) => unknown;
}

const makeContext = (): TestContext => {
  const headers = new Headers();
  const ctx: TestContext = {
    finalized: false,
    header(name, value, opts) {
      const { append } = opts ?? {};
      if (append === true) headers.append(name, value);
      else headers.set(name, value);
      return ctx;
    },
    res: { headers, status: 200 },
    status(code) {
      ctx.res.status = code;
      return ctx;
    },
  };
  return ctx;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double stands in for the Hono context the adapter hands the middleware.
const asContext = (ctx: TestContext): NestContext => ctx as unknown as NestContext;

const surfaceOf = (ctx: TestContext): ProxySurface => {
  const { proxy } = middlewareResponse(asContext(ctx));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the proxy layers the Express response surface onto the Hono context.
  return proxy as unknown as ProxySurface;
};

describe('middlewareResponse shape', () => {
  test('returns an object with commit and proxy', () => {
    const ctx = makeContext();
    const result = middlewareResponse(asContext(ctx));
    expect(result).toHaveProperty('commit');
    expect(result).toHaveProperty('proxy');
  });

  test('proxy has end method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).end).toBe('function');
  });

  test('proxy has write method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).write).toBe('function');
  });

  test('proxy has getHeader method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).getHeader).toBe('function');
  });

  test('proxy has setHeader method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).setHeader).toBe('function');
  });

  test('proxy has hasHeader method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).hasHeader).toBe('function');
  });

  test('proxy has removeHeader method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).removeHeader).toBe('function');
  });

  test('proxy has appendHeader method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).appendHeader).toBe('function');
  });
});

describe('middlewareResponse events', () => {
  test('proxy has headersSent getter', () => {
    const ctx = makeContext();
    expect(surfaceOf(ctx).headersSent).toBeDefined();
  });

  test('proxy has statusCode getter', () => {
    const ctx = makeContext();
    expect(surfaceOf(ctx).statusCode).toBeDefined();
  });

  test('proxy has on method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).on).toBe('function');
  });

  test('proxy has off method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).off).toBe('function');
  });

  test('proxy has once method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).once).toBe('function');
  });

  test('proxy has addListener method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).addListener).toBe('function');
  });

  test('proxy has removeListener method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).removeListener).toBe('function');
  });

  test('proxy has writeHead method', () => {
    const ctx = makeContext();
    expect(typeof surfaceOf(ctx).writeHead).toBe('function');
  });
});

describe('middlewareResponse header behaviour', () => {
  test('getHeader returns the header value', () => {
    const ctx = makeContext();
    ctx.header('x-custom', 'value');
    expect(surfaceOf(ctx).getHeader('x-custom')).toBe('value');
  });

  test('hasHeader returns true for existing header', () => {
    const ctx = makeContext();
    ctx.header('x-custom', 'value');
    expect(surfaceOf(ctx).hasHeader('x-custom')).toBe(true);
  });

  test('hasHeader returns false for missing header', () => {
    const ctx = makeContext();
    expect(surfaceOf(ctx).hasHeader('x-missing')).toBe(false);
  });

  test('setHeader sets a header', () => {
    const ctx = makeContext();
    surfaceOf(ctx).setHeader('x-custom', 'value');
    expect(ctx.res.headers.get('x-custom')).toBe('value');
  });

  test('removeHeader removes a header', () => {
    const ctx = makeContext();
    ctx.header('x-gone', 'old');
    surfaceOf(ctx).removeHeader('x-gone');
    expect(ctx.res.headers.has('x-gone')).toBe(false);
  });

  test('appendHeader appends a header', () => {
    const ctx = makeContext();
    surfaceOf(ctx).appendHeader('x-multi', 'value');
    expect(ctx.res.headers.get('x-multi')).toBe('value');
  });
});

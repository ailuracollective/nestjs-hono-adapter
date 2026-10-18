import { describe, expect, test } from 'bun:test';

import { fitResponse, writer } from '#adapter/compat/express/surface';
import type { NestContext } from '#adapter/core/context';

const NOT_FOUND = 404;

interface TestContext {
  header: (name: string, value: string, opts?: { append?: boolean }) => TestContext;
  res: { headers: Headers; status: number };
}

interface ResponseSurface {
  append: (field: string, value: string) => TestContext;
  send: (body: unknown) => TestContext;
  set: (field: string | Record<string, string>, value?: string) => TestContext;
  status: (code: number) => TestContext;
  type: (value: string) => TestContext;
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
    res: { headers, status: 200 },
  };
  return ctx;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double stands in for the Hono context the adapter hands the fitted surface.
const asContext = (ctx: TestContext): NestContext => ctx as unknown as NestContext;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fitResponse layers the Express response members onto the Hono context.
const surfaceOf = (ctx: TestContext): ResponseSurface => ctx as unknown as ResponseSurface;

describe('fitResponse members', () => {
  test('sets status method on context', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    expect(surfaceOf(ctx).status).toBeDefined();
  });

  test('sets send method on context', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    expect(surfaceOf(ctx).send).toBeDefined();
  });

  test('sets type method on context', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    expect(surfaceOf(ctx).type).toBeDefined();
  });

  test('sets set method on context', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    expect(surfaceOf(ctx).set).toBeDefined();
  });

  test('sets append method on context', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    expect(surfaceOf(ctx).append).toBeDefined();
  });
});

describe('fitResponse behaviour', () => {
  test('status method sets the response status', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    surfaceOf(ctx).status(NOT_FOUND);
    expect(writer.statusOf(asContext(ctx))).toBe(NOT_FOUND);
  });

  test('set method with string field sets header', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    surfaceOf(ctx).set('x-custom', 'value');
    expect(ctx.res.headers.get('x-custom')).toBe('value');
  });

  test('set method with object sets multiple headers', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    surfaceOf(ctx).set({ 'x-one': '1', 'x-two': '2' });
    expect(ctx.res.headers.get('x-one')).toBe('1');
    expect(ctx.res.headers.get('x-two')).toBe('2');
  });

  test('append method appends a header', () => {
    const ctx = makeContext();
    fitResponse(asContext(ctx), writer);
    surfaceOf(ctx).append('x-multi', 'a');
    surfaceOf(ctx).append('x-multi', 'b');
    expect(ctx.res.headers.get('x-multi')).toBe('a, b');
  });
});

describe('writer', () => {
  test('is defined', () => {
    expect(writer).toBeDefined();
  });
});

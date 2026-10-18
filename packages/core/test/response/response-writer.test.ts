import { describe, expect, test } from 'bun:test';

import { ResponseWriter } from '#adapter/core/response/response-writer';
import type { NestContext } from '#adapter/core/context';

const CREATED = 201;
const FOUND = 302;
const NO_CONTENT = 204;
const NOT_FOUND = 404;

interface TestContext {
  header: (name: string, value: string, opts?: { append?: boolean }) => TestContext;
  res: { headers: Headers; status: number };
  finalized: boolean;
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
  };
  return ctx;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double stands in for the Hono context the adapter hands the writer.
const asContext = (ctx: TestContext): NestContext => ctx as unknown as NestContext;

describe('ResponseWriter status', () => {
  test('useEtag sets the etag mode', () => {
    const writer = new ResponseWriter();
    writer.useEtag(true);
    expect(writer).toBeDefined();
  });

  test('status records a pending status', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.status(asContext(ctx), NOT_FOUND);
    expect(writer.statusOf(asContext(ctx))).toBe(NOT_FOUND);
  });

  test('statusOf returns undefined when no status was recorded', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    expect(writer.statusOf(asContext(ctx))).toBeUndefined();
  });

  test('reply sends a response with the given body and status', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.reply(asContext(ctx), 'hello');
    expect(writer.statusOf(asContext(ctx))).toBeUndefined();
  });

  test('reply uses the pending status when no status is given', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.status(asContext(ctx), CREATED);
    writer.reply(asContext(ctx), 'created');
    expect(writer.statusOf(asContext(ctx))).toBe(CREATED);
  });
});

describe('ResponseWriter replies', () => {
  test('end sends a response with a message', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.end(asContext(ctx), 'goodbye');
    expect(writer.statusOf(asContext(ctx))).toBeUndefined();
  });

  test('end uses the pending status when no status is given', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.status(asContext(ctx), NO_CONTENT);
    writer.end(asContext(ctx));
    expect(writer.statusOf(asContext(ctx))).toBe(NO_CONTENT);
  });

  test('view sends HTML content type', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.view(asContext(ctx), '<h1>hello</h1>');
    expect(ctx.res.headers.get('content-type')).toBe('text/html; charset=UTF-8');
  });

  test('redirect sets the Location header', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.redirect(asContext(ctx), FOUND, '/new-location');
    expect(ctx.res.headers.get('Location')).toBe('/new-location');
  });

  test('setHeader sets a header', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.setHeader(asContext(ctx), 'x-custom', 'value');
    expect(ctx.res.headers.get('x-custom')).toBe('value');
  });
});

describe('ResponseWriter headers', () => {
  test('getHeader returns a header value', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.setHeader(asContext(ctx), 'x-custom', 'value');
    expect(writer.getHeader(asContext(ctx), 'x-custom')).toBe('value');
  });

  test('getHeader returns undefined for missing header', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    expect(writer.getHeader(asContext(ctx), 'x-missing')).toBeUndefined();
  });

  test('appendHeader appends a header', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    writer.appendHeader(asContext(ctx), 'x-multi', 'a');
    writer.appendHeader(asContext(ctx), 'x-multi', 'b');
    expect(ctx.res.headers.get('x-multi')).toBe('a, b');
  });

  test('isHeadersSent returns false when not finalized', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    expect(writer.isHeadersSent(asContext(ctx))).toBe(false);
  });

  test('isHeadersSent returns true when finalized', () => {
    const writer = new ResponseWriter();
    const ctx = makeContext();
    ctx.finalized = true;
    expect(writer.isHeadersSent(asContext(ctx))).toBe(true);
  });
});

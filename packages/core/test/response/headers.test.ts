import { describe, expect, test } from 'bun:test';

import {
  defaultContentType,
  responseHeaders,
  setDisposition,
} from '#adapter/core/response/headers';

describe('defaultContentType', () => {
  test('sets content-type when absent', () => {
    const headers = new Headers();
    defaultContentType(headers, 'application/json');
    expect(headers.get('content-type')).toBe('application/json');
  });

  test('does not override existing content-type', () => {
    const headers = new Headers();
    headers.set('content-type', 'text/plain');
    defaultContentType(headers, 'application/json');
    expect(headers.get('content-type')).toBe('text/plain');
  });
});

describe('setDisposition', () => {
  test('appends a string disposition', () => {
    const headers = new Headers();
    setDisposition(headers, 'attachment');
    expect(headers.get('content-disposition')).toBe('attachment');
  });

  test('appends each entry of an array disposition', () => {
    const headers = new Headers();
    setDisposition(headers, ['inline', 'attachment']);
    expect(headers.get('content-disposition')).toBe('inline, attachment');
  });
});

describe('responseHeaders', () => {
  test('returns the response headers object', () => {
    const headers = new Headers();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double carries the res surface the header reader reads back.
    const context = { res: { headers } } as unknown as Parameters<typeof responseHeaders>[0];
    expect(responseHeaders(context)).toBe(headers);
  });
});

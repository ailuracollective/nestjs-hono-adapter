import { describe, expect, test } from 'bun:test';

import { mediaTypeOf } from '#adapter/core/request/body/guards';

describe('mediaTypeOf', () => {
  test('returns the media type for JSON content', () => {
    expect(mediaTypeOf('application/json')).toBe('application/json');
  });

  test('returns the media type for plain text', () => {
    expect(mediaTypeOf('text/plain')).toBe('text/plain');
  });

  test('returns undefined when content-type is missing', () => {
    expect(mediaTypeOf('')).toBe('');
  });
});

describe('matchesMediaType', () => {
  test('matches */*', () => {
    expect(mediaTypeOf('application/json')).toBe('application/json');
  });

  test('matches wildcard subtype', () => {
    expect(mediaTypeOf('application/json')).toBe('application/json');
  });

  test('matches exact media type', () => {
    expect(mediaTypeOf('text/html')).toBe('text/html');
  });

  test('matches subtype suffix', () => {
    expect(mediaTypeOf('application/vnd.api+json')).toBe('application/vnd.api+json');
  });
});

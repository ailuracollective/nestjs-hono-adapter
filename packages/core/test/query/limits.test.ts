import { expect, test } from 'bun:test';

import { parseQuery } from '#adapter/core/request/query/index';

/** The pair ceiling the parser keeps. */
const PAIRS_KEPT = 1000;

/** A run of `count` distinct assignments, `k0=v0` upwards. */
const pairsOf = (count: number): string[] =>
  Array.from(
    { length: count },
    (_unused, index) => `k${index}=v${index}`,
  );

test('a long list is not capped, a long query string is', () => {
  const names = Array.from(
    { length: 40 },
    (_unused, index) => `k${index}`,
  );
  const long = names.map((name) => `${name}=v`).join('&');
  expect(Object.keys(parseQuery(long))).toHaveLength(
    names.length,
  );

  const source = pairsOf(PAIRS_KEPT + 1).join('&');
  const query = parseQuery(source);
  expect(Object.keys(query)).toHaveLength(PAIRS_KEPT);
  expect(query.k0).toBe('v0');
  expect(query.k999).toBe('v999');
});

test('a query string at the pair ceiling keeps all of its pairs', () => {
  const query = parseQuery(pairsOf(PAIRS_KEPT).join('&'));
  expect(Object.keys(query)).toHaveLength(PAIRS_KEPT);
  expect(query.k0).toBe('v0');
  expect(query.k999).toBe('v999');
});

test('a dropped name leaves the prototype chain alone', () => {
  const query = parseQuery('__proto__=yes&safe=yes');
  expect(query).toStrictEqual({ safe: 'yes' });
  expect(Object.getPrototypeOf(query)).toBe(Object.prototype);
});

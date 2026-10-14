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

test('brackets past the depth ceiling fold into one literal key', () => {
  expect(
    parseQuery(
      'alpha[beta][gamma][delta][epsilon][zeta][eta][theta][iota]=j',
    ),
  ).toStrictEqual({
    alpha: {
      beta: {
        gamma: {
          delta: {
            epsilon: { '[zeta][eta][theta][iota]': 'j' },
          },
        },
      },
    },
  });
});

test('five nested levels are kept and a sixth one folds', () => {
  expect(
    parseQuery('alpha[beta][gamma][delta][epsilon]=f'),
  ).toStrictEqual({
    alpha: { beta: { gamma: { delta: { epsilon: 'f' } } } },
  });
  expect(
    parseQuery('alpha[beta][gamma][delta][epsilon][zeta]=g'),
  ).toStrictEqual({
    alpha: {
      beta: {
        gamma: { delta: { epsilon: { '[zeta]': 'g' } } },
      },
    },
  });
});

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

test('names that reach the prototype chain are dropped', () => {
  const query = parseQuery(
    '__proto__[polluted]=yes&constructor[prototype][x]=yes&safe=yes',
  );
  const name = 'polluted';
  const plain: Record<string, unknown> = {};
  expect(query).toStrictEqual({ safe: 'yes' });
  expect(Object.getPrototypeOf(query)).toBe(Object.prototype);
  expect(plain[name]).toBeUndefined();
});

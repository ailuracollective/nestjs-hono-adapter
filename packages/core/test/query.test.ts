import { expect, test } from 'bun:test';

import { parseQuery } from '../src/core/query.ts';

/**
 * The pair ceiling `qs` has always defaulted to, restated here
 * so the boundary is written down next to what it protects.
 */
const PAIRS_KEPT = 1000;

/** A run of `count` distinct assignments, `k0=v0` upwards. */
function pairsOf(count: number): string[] {
  return Array.from(
    { length: count },
    (_unused, index) => `k${index}=v${index}`,
  );
}

test('a repeated name becomes a list', () => {
  expect(parseQuery('ids=1&ids=2')).toStrictEqual({
    ids: ['1', '2'],
  });
});

test('brackets build lists and nested objects', () => {
  expect(parseQuery('tags[]=a&tags[]=b')).toStrictEqual({
    tags: ['a', 'b'],
  });
  expect(
    parseQuery('filter[name]=x&filter[deep][level]=y'),
  ).toStrictEqual({
    filter: { deep: { level: 'y' }, name: 'x' },
  });
});

test('a numeric bracket indexes a list', () => {
  expect(parseQuery('ids[0]=a&ids[1]=b')).toStrictEqual({
    ids: ['a', 'b'],
  });
  expect(parseQuery('rows[0][name]=a')).toStrictEqual({
    rows: [{ name: 'a' }],
  });
});

test('percent and plus sequences are decoded', () => {
  expect(parseQuery('name=hello+world')).toStrictEqual({
    name: 'hello world',
  });
  expect(parseQuery('city=S%C3%A3o')).toStrictEqual({
    city: 'São',
  });
});

test('a leading question mark and empty pairs are ignored', () => {
  expect(parseQuery('?alpha=1&&beta=')).toStrictEqual({
    alpha: '1',
    beta: '',
  });
});

test('a value without an equals sign is empty', () => {
  expect(parseQuery('flag')).toStrictEqual({ flag: '' });
});

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

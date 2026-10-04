import { expect, test } from 'bun:test';

import { parseQuery } from '../src/core/query.ts';

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

import { expect, test } from 'bun:test';

import { parseQuery } from '#adapter/core/request/query/index';

test('a repeated name becomes a list', () => {
  expect(parseQuery('ids=1&ids=2')).toStrictEqual({
    ids: ['1', '2'],
  });
});

test('bracketed names are literal keys', () => {
  expect(parseQuery('tags[]=a&tags[]=b')).toStrictEqual({
    'tags[]': ['a', 'b'],
  });
  expect(parseQuery('filter[name]=x&filter[deep][level]=y')).toStrictEqual({
    'filter[deep][level]': 'y',
    'filter[name]': 'x',
  });
});

test('a numeric bracket is a literal key too', () => {
  expect(parseQuery('ids[0]=a&ids[1]=b')).toStrictEqual({
    'ids[0]': 'a',
    'ids[1]': 'b',
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
  expect(parseQuery('__proto__=x&constructor=y&prototype=z&safe=1')).toStrictEqual({ safe: '1' });
});

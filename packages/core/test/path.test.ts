import { expect, test } from 'bun:test';

import { toHonoPath } from '#adapter/core/request/path';

test('a plain path is left alone', () => {
  expect(toHonoPath('/users')).toBe('/users');
  expect(toHonoPath('/users/:id')).toBe('/users/:id');
  expect(toHonoPath('/users/:id?')).toBe('/users/:id?');
  expect(toHonoPath('/files/*')).toBe('/files/*');
});

test('a constraint becomes the braced form', () => {
  expect(toHonoPath(String.raw`/users/:id(\d+)`)).toBe(String.raw`/users/:id{\d+}`);
});

test('an optional segment becomes an optional parameter', () => {
  expect(toHonoPath('/users{/:id}')).toBe('/users/:id?');
  expect(toHonoPath(String.raw`/users{/:id(\d+)}`)).toBe(String.raw`/users/:id{\d+}?`);
});

test('a named wildcard becomes an anonymous one', () => {
  expect(toHonoPath('/files/*rest')).toBe('/files/*');
  expect(toHonoPath('/files/*rest/meta')).toBe('/files/*/meta');
});

test('an optional wildcard group becomes the wildcard Hono already reads', () => {
  expect(toHonoPath('/admin/queues{/*wildcard}')).toBe('/admin/queues/*');
  expect(toHonoPath('/admin/queues{/*wildcard}/*')).toBe('/admin/queues/*');
  expect(toHonoPath('/queues{/*}')).toBe('/queues/*');
});

test('an inline alternation becomes a segment regex parameter', () => {
  expect(toHonoPath('/feeds/all.(json|rss|atom)')).toBe(
    String.raw`/feeds/:group1{all\.(json|rss|atom)}`,
  );
  expect(toHonoPath('/(a|b)/x')).toBe('/:group1{(a|b)}/x');
});

test('a generated name does not shadow a parameter the route carries', () => {
  expect(toHonoPath('/x/:group1/(a|b)')).toBe('/x/:group1/:group2{(a|b)}');
});

test('a path the router cannot read is refused', () => {
  expect(() => toHonoPath('/users{name}')).toThrow(TypeError);
  expect(() => toHonoPath('/users{/:id/:tab}')).toThrow(TypeError);
  expect(() => toHonoPath('/users/:id(')).toThrow(TypeError);
  expect(() => toHonoPath('/users(:id')).toThrow(TypeError);
});

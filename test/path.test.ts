import { expect, test } from 'vitest';

import { toHonoPath } from '../src/core/path.ts';

test('a plain path is left alone', () => {
  expect(toHonoPath('/users')).toBe('/users');
  expect(toHonoPath('/users/:id')).toBe('/users/:id');
  expect(toHonoPath('/users/:id?')).toBe('/users/:id?');
  expect(toHonoPath('/files/*')).toBe('/files/*');
});

test('a constraint becomes the braced form', () => {
  expect(toHonoPath(String.raw`/users/:id(\d+)`)).toBe(
    String.raw`/users/:id{\d+}`,
  );
});

test('an optional segment becomes an optional parameter', () => {
  expect(toHonoPath('/users{/:id}')).toBe('/users/:id?');
  expect(toHonoPath(String.raw`/users{/:id(\d+)}`)).toBe(
    String.raw`/users/:id{\d+}?`,
  );
});

test('a named wildcard becomes an anonymous one', () => {
  expect(toHonoPath('/files/*rest')).toBe('/files/*');
  expect(toHonoPath('/files/*rest/meta')).toBe('/files/*/meta');
});

test('a path the router cannot read is refused', () => {
  expect(() => toHonoPath('/users{name}')).toThrow(TypeError);
  expect(() => toHonoPath('/users{/:id/:tab}')).toThrow(
    TypeError,
  );
  expect(() => toHonoPath('/users/:id(')).toThrow(TypeError);
  expect(() => toHonoPath('/users(:id')).toThrow(TypeError);
});

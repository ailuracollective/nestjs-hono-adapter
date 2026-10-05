import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { toHonoPath } from '../src/core/path.ts';
import { request } from './probe.ts';
import { startProbe } from './support.ts';

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

/**
 * The translation above answers the wildcard with `*`, so the
 * capture has to be readable from the request under the key the
 * router reads it by — the same one Fastify uses — and a route
 * declared `*rest` reaches the rest of its path.
 */
test('a wildcard is captured under the key the router reads it by', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    const response = await request(
      probe,
      '/files/reports/2024/q1.csv',
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': 'reports/2024/q1.csv' },
    });
  } finally {
    await probe.close();
  }
});

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { toHonoPath } from '#adapter/core/request/path';
import { request } from '#test/probe';
import { startProbe } from './support/index.ts';

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

test('a path the router cannot read is refused', () => {
  expect(() => toHonoPath('/users{name}')).toThrow(TypeError);
  expect(() => toHonoPath('/users{/:id/:tab}')).toThrow(TypeError);
  expect(() => toHonoPath('/users/:id(')).toThrow(TypeError);
  expect(() => toHonoPath('/users(:id')).toThrow(TypeError);
});

test('a wildcard is captured under the key the router reads it by', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    const response = await request(probe, '/files/reports/2024/q1.csv');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': 'reports/2024/q1.csv' },
    });
  } finally {
    await probe.close();
  }
});

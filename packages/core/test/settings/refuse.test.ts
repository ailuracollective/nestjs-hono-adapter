import { expect, test } from 'bun:test';

import { bunAdapter } from '#test/bun-adapter';

import { ENGINE, engine } from './fixture.ts';

test('view engine refuses arrays and non-string values', () => {
  const adapter = bunAdapter({ views: { engine } });
  expect(() => adapter.set('view engine', [ENGINE])).toThrow('it takes a string');
  expect(() => adapter.set('view engine', true)).toThrow('it takes a string');
});

test('set refuses a setting the transport owns, by name', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.set('trust proxy', true);
  }).toThrow('trust proxy');
  expect(() => {
    adapter.set('trust proxy', true);
  }).toThrow('adapter options');
});

test('set refuses a setting with no behaviour behind it', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.set('env', 'production');
  }).toThrow('env');
  expect(() => {
    adapter.set('etag', true);
  }).toThrow('etag');
});

test('enable and disable go through the same refusal', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.enable('trust proxy');
  }).toThrow('trust proxy');
  expect(() => {
    adapter.disable('x-powered-by');
  }).toThrow('x-powered-by');
});

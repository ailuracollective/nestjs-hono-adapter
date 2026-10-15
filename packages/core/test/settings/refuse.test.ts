import { expect, test } from 'bun:test';

import { bunAdapter } from '#test/bun-adapter';

import { ENGINE, engine } from './fixture.ts';

test('view engine refuses arrays and non-string values', () => {
  const adapter = bunAdapter({ views: { engine } });
  expect(() => adapter.set('view engine', [ENGINE])).toThrow('it takes a string');
  expect(() => adapter.set('view engine', true)).toThrow('it takes a string');
});

// `trust proxy` and `etag` are read per request, so an application may set them at bootstrap the way
// Express apps do — unlike the settings the adapter has no behaviour for.
test('trust proxy and etag are honoured, and checked', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.set('trust proxy', ['loopback', '10.0.0.0/8']);
  }).not.toThrow();
  expect(() => {
    adapter.enable('trust proxy');
  }).not.toThrow();
  expect(() => {
    adapter.set('etag', 'strong');
  }).not.toThrow();

  expect(() => {
    adapter.set('trust proxy', {});
  }).toThrow('set("trust proxy")');
  expect(() => {
    adapter.set('etag', 'sometimes');
  }).toThrow('set("etag")');
});

test('set refuses a setting with no behaviour behind it', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.set('env', 'production');
  }).toThrow('env');
});

test('enable and disable go through the same refusal', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.disable('x-powered-by');
  }).toThrow('x-powered-by');
});

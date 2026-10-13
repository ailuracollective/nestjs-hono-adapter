import path from 'node:path';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import type { ViewEngine } from '../src/index.ts';
import { bunAdapter } from './bun-adapter.ts';
import { startProbe } from './support.ts';
import { request } from './probe.ts';

/** The templates the view cases render. */
const FIXTURES = path.join(
  import.meta.dirname,
  'fixtures',
  'views',
);

/** The extension the templates are named with. */
const ENGINE = 'tpl';

/**
 * An engine that reads the local these cases set, so a render
 * proves the local arrived rather than the route's own data.
 */
const engine: ViewEngine = (source, data) =>
  source.replace('{{name}}', String(data.title));

test('a local reaches the template a route renders', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
      app.setLocal('title', 'from the local');
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('hello from the local\n');
  } finally {
    await probe.close();
  }
});

test('set honours the settings that name behaviour', async () => {
  const probe = await startProbe({
    // The directory is named through `set()` below, so a `views`
    // call that stopped delegating leaves the case with none.
    adapter: { views: { engine } },
    configure: (app) => {
      app.set('view engine', ENGINE);
      app.set('views', FIXTURES);
      app.setLocal('title', 'set');
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.text).toBe('hello set\n');
  } finally {
    await probe.close();
  }
});

/**
 * The refusal cases call the adapter rather than the
 * application on purpose. Nest wraps every application method
 * in an exception zone whose teardown is `process.exit(1)`, so
 * a throw raised through `app.set()` ends the test run before
 * `toThrow()` can see it — the same reason `views.test.ts`
 * checks its refusals on the adapter.
 */
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

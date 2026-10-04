import path from 'node:path';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import type { ViewEngine } from '../src/index.ts';
import { ServerAdapter } from '../src/index.ts';
import { request, startProbe } from './support.ts';

/** The templates the view cases render. */
const FIXTURES = path.join(
  import.meta.dir,
  'fixtures',
  'views',
);

/** The extension the templates are named with. */
const ENGINE = 'tpl';

/** An engine small enough to read: it fills one placeholder. */
const engine: ViewEngine = (source, data) =>
  source.replace('{{name}}', String(data.name));

test('a view is rendered with the engine the deployment gave', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
    },
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toBe('hello Nest\n');
  } finally {
    await probe.close();
  }
});

test('a view directory named on the application is read from', async () => {
  const probe = await startProbe({
    adapter: { views: { engine } },
    configure: (app) => {
      app.setBaseViewsDir(FIXTURES);
      app.setViewEngine(`.${ENGINE}`);
    },
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('hello Nest\n');
  } finally {
    await probe.close();
  }
});

test('a view that does not exist is a not-found answer', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
    },
  });
  try {
    const response = await request(probe, '/view/missing');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

/**
 * A case that checks a refusal calls the adapter rather than
 * the application: Bun ends a run when a Nest application
 * method throws, which Nest's own `app.get('nope')` shows too.
 */
test('naming an engine without one configured is refused', () => {
  const adapter = new ServerAdapter();

  expect(() => {
    adapter.setViewEngine(ENGINE);
  }).toThrow(TypeError);
});

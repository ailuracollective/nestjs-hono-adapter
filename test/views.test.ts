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

/** An engine small enough to read: it fills one placeholder. */
const engine: ViewEngine = (source, data) =>
  source.replace('{{name}}', String(data.name));

test('a view is rendered with the engine the deployment gave', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
    },
    mode: 'in-process',
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

test('a rendered POST view carries the default created status', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view/created', {
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toBe('hello Nest\n');
  } finally {
    await probe.close();
  }
});

test('a view carries the status the route declared', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES, engine } },
    configure: (app) => {
      app.setViewEngine(ENGINE);
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view/accepted');
    expect(response.status).toBe(HttpStatus.ACCEPTED);
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
    mode: 'in-process',
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
    mode: 'in-process',
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
 * the application: a throw from a Nest application method ends
 * the test run, which Nest's own `app.get('nope')` shows too.
 */
test('naming an engine without one configured is refused', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.setViewEngine(ENGINE);
  }).toThrow(TypeError);
});

/** An engine in the shape Fastify hands to its view plugin. */
const fastifyEngine = { render: engine };

test("Fastify's options object configures the views", async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.setViewEngine({
        engine: { tpl: fastifyEngine },
        root: FIXTURES,
        viewExt: ENGINE,
      });
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('hello Nest\n');
  } finally {
    await probe.close();
  }
});

test('locals survive default context configuration and later renders', async () => {
  const defaults = Object.freeze({
    extra: 'first',
    name: 'default',
    title: 'default',
  });
  const probe = await startProbe({
    adapter: {
      views: {
        directory: FIXTURES,
        engine: (_source, data) => JSON.stringify(data),
      },
    },
    configure: (app) => {
      app.setLocal('title', 'local');
      app.setLocal('before', 'kept');
      app.setViewEngine({
        defaultContext: defaults,
        viewExt: ENGINE,
      });
      app.setLocal('after', 'added');
    },
    mode: 'in-process',
  });
  try {
    const first = await request(probe, '/view');
    expect(JSON.parse(first.text)).toStrictEqual({
      after: 'added',
      before: 'kept',
      extra: 'first',
      name: 'Nest',
      title: 'local',
    });
    probe.app.setViewEngine({
      defaultContext: { extra: 'second', name: 'new default' },
    });
    probe.app.setLocal('title', 'updated');
    const second = await request(probe, '/view');
    expect(JSON.parse(second.text)).toStrictEqual({
      after: 'added',
      before: 'kept',
      extra: 'second',
      name: 'Nest',
      title: 'updated',
    });
  } finally {
    await probe.close();
  }
});

// oxlint-disable-next-line unicorn/no-null -- a null local must be stored as data too.
test.each([{ injected: true }, 'ordinary data', null])(
  '__proto__ is passed to the engine as an own local: %j',
  async (value) => {
    const probe = await startProbe({
      adapter: {
        views: {
          directory: FIXTURES,
          engine: (_source, data) =>
            JSON.stringify([
              Object.hasOwn(data, '__proto__'),
              Object.getPrototypeOf(data) === Object.prototype,
              data,
            ]),
        },
      },
      configure: (app) => {
        app.setLocal('__proto__', value);
        app.setViewEngine({
          defaultContext: { title: 'default' },
          viewExt: ENGINE,
        });
        app.setLocal('title', 'local');
      },
      mode: 'in-process',
    });
    try {
      const response = await request(probe, '/view');
      expect(response.status).toBe(HttpStatus.OK);
      expect(JSON.parse(response.text)).toStrictEqual([
        true,
        true,
        Object.fromEntries([
          ['__proto__', value],
          ['name', 'Nest'],
          ['title', 'local'],
        ]),
      ]);
    } finally {
      await probe.close();
    }
  },
);

test('a field the adapter cannot honour is refused', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.setViewEngine({
      charset: 'latin1',
      root: FIXTURES,
    });
  }).toThrow(TypeError);
});

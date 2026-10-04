import path from 'node:path';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import { request, startProbe } from './support.ts';

/** The files the static asset cases serve. */
const FIXTURES = path.join(
  import.meta.dir,
  'fixtures',
  'public',
);

/** The name the directory index is configured with. */
const INDEX = 'home.txt';

/** A week, as the option is written and as it is sent. */
const WEEK_IN_MS = 604_800_000;
const WEEK_HEADER = 'public, max-age=604800';

test('a file under the prefix is served', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, { prefix: '/public' });
    },
  });
  try {
    const response = await request(probe, '/public/hello.txt');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/plain');
    expect(response.text).toBe('static asset\n');
  } finally {
    await probe.close();
  }
});

test('a directory request is answered with its index', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, {
        index: INDEX,
        prefix: '/public',
      });
    },
  });
  try {
    const response = await request(probe, '/public/nested/');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('index served\n');
  } finally {
    await probe.close();
  }
});

test('a maximum age is written as a cache header', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, {
        maxAge: WEEK_IN_MS,
        prefix: '/public',
      });
    },
  });
  try {
    const response = await request(probe, '/public/hello.txt');
    expect(response.headers.get('cache-control')).toBe(
      WEEK_HEADER,
    );
  } finally {
    await probe.close();
  }
});

test('a file that does not exist reaches the routes', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, { prefix: '/public' });
    },
  });
  try {
    const response = await request(
      probe,
      '/public/missing.txt',
    );
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
test('an option the handler cannot honour is refused', () => {
  const adapter = new ServerAdapter();

  expect(() => {
    adapter.useStaticAssets(FIXTURES, {
      setHeaders: () => 'x',
    });
  }).toThrow(TypeError);
});

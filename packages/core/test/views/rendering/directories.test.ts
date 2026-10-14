import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';

import {
  ENGINE,
  FIXTURES,
  engine,
} from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';

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

test('naming an engine does not throw before it is loaded', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.setViewEngine('ejs');
  }).not.toThrow();
});

test('a named engine that cannot be loaded fails the render', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.setBaseViewsDir(FIXTURES);
      app.setViewEngine('an-engine-that-is-not-installed');
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    await probe.close();
  }
});

import path from 'node:path';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

import { ENGINE, FIXTURES, engine } from './fixture.ts';

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

test('set reads views from a directory array in order', async () => {
  const probe = await startProbe({
    adapter: { views: { engine } },
    configure: (app) => {
      app.set('view engine', ENGINE);
      app.set('views', [path.join(FIXTURES, 'missing'), FIXTURES]);
      app.setLocal('title', 'from the second directory');
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('hello from the second directory\n');
  } finally {
    await probe.close();
  }
});

test.each(
  // oxlint-disable-next-line unicorn/no-null -- null is an invalid public setting value worth checking.
  [true, null, {}, [FIXTURES, 1]].map((value) => ({ value })),
)('views refuses an invalid directory value: %j', ({ value }) => {
  const adapter = bunAdapter();
  expect(() => adapter.set('views', value)).toThrow('views');
});

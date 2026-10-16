import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

import { FIXTURES } from './fixture.ts';

test('an option the handler cannot honour is refused', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.useStaticAssets(FIXTURES, {
      setHeaders: () => 'x',
    });
  }).toThrow(TypeError);
});

test("Fastify's single object names the root inside it", async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets({
        prefix: '/public',
        root: FIXTURES,
      });
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/public/hello.txt');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('static asset\n');
  } finally {
    await probe.close();
  }
});

test('naming no directory at all is refused', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.useStaticAssets({ prefix: '/public' });
  }).toThrow(TypeError);
});

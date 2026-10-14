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

/** An engine wrapped in a render object. */
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

test('a field the adapter cannot honour is refused', () => {
  const adapter = bunAdapter();

  expect(() => {
    adapter.setViewEngine({
      charset: 'latin1',
      root: FIXTURES,
    });
  }).toThrow(TypeError);
});

import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { FIXTURES } from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';

test('a named engine is loaded and renders the view', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.setBaseViewsDir(FIXTURES);
      app.setViewEngine('ejs');
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('hello Nest');
  } finally {
    await probe.close();
  }
});

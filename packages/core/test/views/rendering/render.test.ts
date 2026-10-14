import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import {
  ENGINE,
  FIXTURES,
  engine,
} from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';

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

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

import { FIXTURES, INDEX, WEEK_HEADER, WEEK_IN_MS } from './fixture.ts';

test('a file under the prefix is served', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, { prefix: '/public' });
    },
    mode: 'in-process',
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
    mode: 'in-process',
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
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/public/hello.txt');
    expect(response.headers.get('cache-control')).toBe(WEEK_HEADER);
  } finally {
    await probe.close();
  }
});

test('a file that does not exist reaches the routes', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.useStaticAssets(FIXTURES, { prefix: '/public' });
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/public/missing.txt');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

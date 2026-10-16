import { beforeEach, expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import {
  configured,
  withEnvFile,
  withExpandedEnvFile,
  withUnexpandedEnvFile,
} from '#compat-test/config-fixture';
import {
  APP_GREETING,
  APP_GREETING_WRITTEN,
  APP_NAME,
  APP_PORT,
  snapshotEnvironment,
  withProbe,
} from './support.ts';

beforeEach(snapshotEnvironment);

test('a variable loaded from a file reaches a route', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(probe, '/config/env/APP_NAME');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_NAME);
  });
});

test('every variable of the file is loaded, not only the first', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(probe, '/config/env/APP_PORT');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_PORT);
  });
});

test('a key nothing loaded is answered as absent', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    const response = await request(probe, '/config/env/APP_MISSING');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('');
  });
});

test('a variable is left as written when expansion is not asked for', async () => {
  await withProbe(configured(withUnexpandedEnvFile()), async (probe) => {
    const response = await request(probe, '/config/env/APP_GREETING');
    expect(response.text).toBe(APP_GREETING_WRITTEN);
  });
});

test('expansion resolves a variable written in terms of another', async () => {
  await withProbe(configured(withExpandedEnvFile()), async (probe) => {
    const response = await request(probe, '/config/env/APP_GREETING');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_GREETING);
  });
});

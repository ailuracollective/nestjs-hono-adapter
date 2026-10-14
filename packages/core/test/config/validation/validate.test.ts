import { beforeEach, expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { request, startProbe } from '#test/probe';
import type { ProbeOptions } from '#test/probe';

import {
  configured,
  requireAppName,
  withRejectedConfig,
  withTransformingValidate,
  withValidate,
  withValidationSchema,
} from '#adapter-test/config-fixture';
import {
  APP_NAME,
  APP_PORT,
  restoreEnvironment,
  snapshotEnvironment,
  withProbe,
} from '#adapter-test/config/support';

beforeEach(snapshotEnvironment);

test('a configuration that passes its validate function is loaded', async () => {
  await withProbe(configured(withValidate()), async (probe) => {
    const response = await request(probe, '/config/env/APP_NAME');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toBe(APP_NAME);
  });
});

test('the validate function rejects a configuration that loaded nothing', () => {
  expect(() => requireAppName({})).toThrow('APP_NAME was not loaded');
});

test('a rejected configuration stops the application from starting', async () => {
  const options: ProbeOptions = Object.assign(configured(withRejectedConfig()), {
    application: { abortOnError: false },
  });

  let reason = '';
  try {
    await startProbe(options);
  } catch (error: unknown) {
    reason = String(error);
  }

  expect(reason).toContain('the configuration was rejected');
  restoreEnvironment();
});

test('a validate function transforms what it lets through', async () => {
  const port = await withProbe(configured(withTransformingValidate()), (probe) =>
    probe.app.get(ConfigService).get<number>('APP_PORT'),
  );

  expect(port).toBe(Number(APP_PORT));
});

test('a schema keeps the variables it did not declare', async () => {
  await withProbe(configured(withValidationSchema()), async (probe) => {
    const name = await request(probe, '/config/env/APP_NAME');
    expect(name.body).toBe(APP_NAME);

    const port = await request(probe, '/config/env/APP_PORT');
    expect(port.body).toBe(APP_PORT);
  });
});

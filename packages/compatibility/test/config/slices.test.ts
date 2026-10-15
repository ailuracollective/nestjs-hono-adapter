/* eslint-disable node/no-process-env */

import { beforeEach, expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { request } from '#test/probe';

import {
  configured,
  databaseConfig,
  withCache,
  withEnvFile,
  withRegisteredSlice,
  withSkipProcessEnv,
} from '#compat-test/config-fixture';
import { DATABASE, snapshotEnvironment, withProbe } from './support.ts';

beforeEach(snapshotEnvironment);

test('a registered slice reaches the constructor that asked for it', async () => {
  await withProbe(configured(withRegisteredSlice()), async (probe) => {
    const response = await request(probe, '/slice/database');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(DATABASE);
  });
});

test('a registered slice is readable by name through the service', async () => {
  const read = await withProbe(configured(withRegisteredSlice()), (probe) => {
    const config = probe.app.get(ConfigService);
    return {
      host: config.get<string>('database.host'),
      port: config.get<number>('database.port'),
    };
  });

  expect(read).toStrictEqual(DATABASE);
});

test('the registered slice names itself with a token forFeature uses', () => {
  expect(databaseConfig.KEY).toBeDefined();
  expect(databaseConfig()).toStrictEqual(DATABASE);
});

test('a cached configuration keeps the value it was loaded with', async () => {
  await withProbe(configured(withCache()), async (probe) => {
    process.env.APP_NAME = 'before-the-start';
    const before = await request(probe, '/config/env/APP_NAME');
    expect(before.body).toBe('before-the-start');

    process.env.APP_NAME = 'after-the-start';
    const after = await request(probe, '/config/env/APP_NAME');
    expect(after.body).toBe('before-the-start');
  });
});

test('an uncached configuration reads the environment again', async () => {
  await withProbe(configured(withEnvFile()), async (probe) => {
    process.env.APP_NAME = 'before-the-start';
    const before = await request(probe, '/config/env/APP_NAME');
    expect(before.body).toBe('before-the-start');

    process.env.APP_NAME = 'after-the-start';
    const after = await request(probe, '/config/env/APP_NAME');
    expect(after.body).toBe('after-the-start');
  });
});

test('the process is not answered for when it is told to be skipped', async () => {
  await withProbe(configured(withSkipProcessEnv()), async (probe) => {
    process.env.APP_NAME = 'from-the-process';

    const response = await request(probe, '/config/env/APP_NAME');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('');
  });
});

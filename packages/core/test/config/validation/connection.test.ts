import { beforeEach, expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import {
  configured,
  withEnvFile,
  withRegisteredSlice,
} from '#adapter-test/config-fixture';
import {
  APP_NAME,
  DATABASE,
  snapshotEnvironment,
  withProbe,
} from '#adapter-test/config/support';

beforeEach(snapshotEnvironment);

test('a loaded configuration answers over a real connection', async () => {
  await withProbe(
    configured(withEnvFile(), 'socket'),
    async (probe) => {
      const response = await request(
        probe,
        '/config/env/APP_NAME',
      );
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.text).toBe(APP_NAME);
    },
  );
});

test('a registered slice answers over a real connection', async () => {
  await withProbe(
    configured(withRegisteredSlice(), 'socket'),
    async (probe) => {
      const response = await request(probe, '/slice/database');
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toStrictEqual(DATABASE);
    },
  );
});

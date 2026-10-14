import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { DEGRADED } from '#adapter-test/terminus/fixture';

import { FAILED_BODY, HEALTHY_BODY, withProbe } from '#adapter-test/terminus/support';

test('a check whose indicators are healthy is answered as healthy', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(HEALTHY_BODY);
  });
});

test('a check whose indicator failed is answered as down', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/failing');

    expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body).toStrictEqual(FAILED_BODY);
  });
});

test('an impaired check stays at 200 while naming the impairment', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/degraded');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toMatchObject({ status: DEGRADED });
  });
});

test('the two checks are told apart by the status alone', async () => {
  await withProbe(async (probe) => {
    const healthy = await request(probe, '/health');
    const failing = await request(probe, '/health/failing');

    expect(healthy.status).toBe(HttpStatus.OK);
    expect(failing.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

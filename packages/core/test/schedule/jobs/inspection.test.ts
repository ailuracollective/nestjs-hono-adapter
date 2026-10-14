import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { CountingJob, JobModule } from '#adapter-test/schedule/fixture';
import { windows } from '#adapter-test/schedule/helpers';

test('the bootstrap hook ran before any request arrived', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    const response = await request(probe, '/jobs/bootstrapped');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ bootstrapped: true });
  } finally {
    await probe.close();
  }
});

test('the package is holding the interval the job declared', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    const response = await request(probe, '/jobs/intervals');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ count: 1 });
  } finally {
    await probe.close();
  }
});

test('closing the application stops the job', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  const counting = probe.app.get(CountingJob);
  await counting.firstRun;
  await probe.close();

  const afterClose = counting.runs;
  await windows();

  expect(counting.runs).toBe(afterClose);
});

test('a scheduled application answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const response = await request(probe, '/jobs/bootstrapped');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify({ bootstrapped: true }));
  } finally {
    await probe.close();
  }
});

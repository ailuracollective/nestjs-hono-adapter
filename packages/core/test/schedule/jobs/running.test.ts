import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { CountingJob, JobModule } from '#adapter-test/schedule/fixture';
import { runsReportedBy, windows } from '#adapter-test/schedule/helpers';

test('a scheduled job runs with the application up', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const runs = await runsReportedBy(probe);

    expect(runs).toBeGreaterThanOrEqual(1);
  } finally {
    await probe.close();
  }
});

test('a scheduled job keeps running while requests are served', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const before = await runsReportedBy(probe);

    const served = await request(probe, '/jobs/intervals');
    expect(served.status).toBe(HttpStatus.OK);

    await windows();
    const after = await runsReportedBy(probe);

    expect(after).toBeGreaterThan(before);
  } finally {
    await probe.close();
  }
});

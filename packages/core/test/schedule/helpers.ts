import { setTimeout } from 'node:timers/promises';

import type { Probe } from '#test/probe';
import { request } from '#test/probe';

import { EVERY } from './fixture.ts';

/** The status a route that answered is at, as a number. */
const HTTP_OK = 200;

/** How many windows a case lets pass before concluding. */
const WINDOWS = 3;

/** Waits the length of a few windows. */
const windows = async (): Promise<void> => {
  await setTimeout(EVERY * WINDOWS);
};

/** How many times the job has run, as the route reports it. */
const runsReportedBy = async (
  probe: Probe,
): Promise<number> => {
  const answered = await request(probe, '/jobs/runs');
  if (answered.status !== HTTP_OK) {
    throw new Error(
      `the count route answered ${answered.status}`,
    );
  }
  const { body } = answered;
  if (typeof body !== 'object' || body === null) {
    return 0;
  }
  const { runs } = body as { readonly runs?: unknown };
  if (typeof runs !== 'number') {
    return 0;
  }
  return runs;
};

export { runsReportedBy, windows };

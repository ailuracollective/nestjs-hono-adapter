import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import {
  DOWN,
  ERROR,
  HEALTHY,
  HealthModule,
  OK,
  UP,
} from './fixture.ts';

/** The body a healthy check answers with. */
const HEALTHY_BODY = {
  details: { [HEALTHY]: { status: UP } },
  error: {},
  info: { [HEALTHY]: { status: UP } },
  status: OK,
};

/** The body a check with a failing indicator answers with. */
const FAILED_BODY = {
  details: {
    [HEALTHY]: { reason: 'unreachable', status: DOWN },
  },
  error: { [HEALTHY]: { reason: 'unreachable', status: DOWN } },
  info: {},
  status: ERROR,
};

/** Starts the fixture and runs the reader against it. */
const withProbe = async <Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> => {
  const probe = await startProbe({
    mode: 'in-process',
    module: HealthModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

export { FAILED_BODY, HEALTHY_BODY, withProbe };

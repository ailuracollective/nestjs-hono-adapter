import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import {
  DOUBLING,
  DrivenHost,
  INPUT,
  startGateway,
} from './gateway.fixture.ts';
import type { GatewayProbe } from './gateway.fixture.ts';

/** How long a case waits for an answer. */
const QUIET_MS = 150;

/** Waits, without a timer the case has to keep track of. */
const quiet = async (ms: number): Promise<void> => {
  await Bun.sleep(ms);
};

/** Pushes one frame and answers what came. */
const frameThrough = async (
  probe: GatewayProbe,
  host: DrivenHost,
): Promise<unknown[]> => {
  const upgraded = await probe.fetch(
    new Request('http://host.test/ws'),
  );
  expect(upgraded.status).toBe(HttpStatus.SWITCHING_PROTOCOLS);
  if (host.deliver === undefined) {
    throw new TypeError('the upgrade did not reach the host');
  }
  host.deliver(
    JSON.stringify({
      data: { amount: INPUT },
      event: 'ping',
    }),
  );
  await quiet(QUIET_MS);
  return host.frames();
};

test('a gateway served through the host helper answers a frame', async () => {
  const host = new DrivenHost();
  const probe = await startGateway(host);
  try {
    expect(await frameThrough(probe, host)).toStrictEqual([
      { data: { doubled: INPUT * DOUBLING }, event: 'ping' },
    ]);
  } finally {
    await probe.close();
  }
});

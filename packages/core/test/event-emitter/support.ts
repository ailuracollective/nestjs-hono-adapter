import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import { OrderModule, received } from './fixture.ts';

/** The request a case posts to the order route. */
const ORDER_REQUEST = { method: 'POST' };

/** Starts the fixture with an empty record. */
const withProbe = async <Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> => {
  received.length = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: OrderModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

export { ORDER_REQUEST, withProbe };

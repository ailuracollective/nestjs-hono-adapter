import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import { OrderModule, received } from './fixture.ts';

const ORDER_REQUEST = { method: 'POST' };

const withProbe = async <Answer>(read: (probe: Probe) => Promise<Answer>): Promise<Answer> => {
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

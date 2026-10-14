import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import { CacheModuleFixture, resetCalls } from './controller.ts';

const withProbe = async <Answer>(read: (probe: Probe) => Promise<Answer>): Promise<Answer> => {
  resetCalls();
  const probe = await startProbe({
    mode: 'in-process',
    module: CacheModuleFixture,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

export { withProbe };

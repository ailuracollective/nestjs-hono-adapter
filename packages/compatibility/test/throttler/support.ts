import type { Probe } from '#test/probe';
import { request, startProbe } from '#test/probe';

import { LIMIT, ThrottledModule } from './fixture.ts';

const withProbe = async <Answer>(read: (probe: Probe) => Promise<Answer>): Promise<Answer> => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ThrottledModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

const exhaust = async (probe: Probe, path: string): Promise<void> => {
  await Promise.all(Array.from({ length: LIMIT }, () => request(probe, path)));
};

export { exhaust, withProbe };

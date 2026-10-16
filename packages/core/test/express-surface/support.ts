import { startProbe } from '#test/probe';
import type { Probe } from '#test/probe';

import { PageModule, hasSurface } from './fixture.ts';
import type { ExpressResponse } from './fixture.ts';

const surfaceOf = (response: unknown): ExpressResponse => {
  if (!hasSurface(response)) {
    throw new TypeError('the context carries no express surface');
  }
  return response;
};

const withSurface = async (
  handler: (response: ExpressResponse) => void,
  run: (probe: Probe) => Promise<void>,
): Promise<void> => {
  const probe = await startProbe({
    configure: (app) => {
      app.use('/reference', (_request: unknown, response: unknown) => {
        handler(surfaceOf(response));
      });
    },
    mode: 'in-process',
    module: PageModule,
  });
  try {
    await run(probe);
  } finally {
    await probe.close();
  }
};

export { surfaceOf, withSurface };

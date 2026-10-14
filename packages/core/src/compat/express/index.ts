import type { Bridge } from '#adapter/compat/types';

import { installErrorMiddleware } from './middleware-fit.ts';

const expressBridge: Bridge = {
  install: ({ hono }) => {
    installErrorMiddleware(hono);
  },
  name: 'express',
};

export { installSurface } from './surface-fit.ts';
export { expressBridge };

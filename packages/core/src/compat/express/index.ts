import type { Bridge } from '#adapter/compat/types';

import { installErrorMiddleware } from './middleware-fit.ts';

/**
 * Lets Nest's own Express-shaped code run: an error middleware,
 * `res.send()`, `res.type()`.
 */
const expressBridge: Bridge = {
  install: ({ hono }) => {
    installErrorMiddleware(hono);
  },
  name: 'express',
};

export { installSurface } from './surface-fit.ts';
export { expressBridge };

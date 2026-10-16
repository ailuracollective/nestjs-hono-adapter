import type { Bridge } from '#adapter/compat/types';

// The Express response surface is fitted onto each request, and a four-argument handler is
// recognised where Nest mounts it, so an application has nothing left to install.
const expressBridge: Bridge = {
  install: () => {
    // The surface is fitted per request and the error middleware at mount, so there is nothing to
    // install on the application itself.
  },
  name: 'express',
};

export { expressErrorMiddleware } from './middleware-run.ts';
export { installSurface } from './surface-fit.ts';
export { expressBridge };

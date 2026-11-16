import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { installInertia } from './install.ts';

const bridge: Bridge = {
  install: (target) => {
    installInertia(target);
  },
  name: 'inertia',
};

export { bridge };

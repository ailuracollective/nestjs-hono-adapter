import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchServerAdapter } from './patch-server.ts';
import { fitSurface } from './surface.ts';

const bridge: Bridge = {
  install: (target) => {
    patchServerAdapter(target.adapter);
    fitSurface(target);
  },
  name: 'inertia',
};

export { bridge };

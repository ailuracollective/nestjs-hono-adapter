import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchWsAdapter } from './patch.ts';

const bridge: Bridge = {
  install: (target) => patchWsAdapter(target),
  name: 'ws',
};

export { bridge };

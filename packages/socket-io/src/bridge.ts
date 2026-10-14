import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchIoAdapter } from './patch.ts';

const bridge: Bridge = {
  install: (target) => patchIoAdapter(target),
  name: 'socket-io',
};

export { bridge };

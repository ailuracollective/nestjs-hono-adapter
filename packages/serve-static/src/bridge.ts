import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { loadPeers } from './peer-load.ts';
import { swapLoader } from './swap.ts';

const bridge: Bridge = {
  install: async () => {
    const peers = await loadPeers();
    swapLoader(peers);
  },
  name: 'serve-static',
};

export { bridge };

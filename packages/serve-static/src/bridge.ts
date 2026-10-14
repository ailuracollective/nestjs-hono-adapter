import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { loadPeers } from './peer-load.ts';
import { swapLoader } from './swap.ts';

/**
 * Swaps `@nestjs/serve-static`'s loader for one that reads
 * through the transport.
 */
const bridge: Bridge = {
  install: async () => {
    const peers = await loadPeers();
    swapLoader(peers);
  },
  name: 'serve-static',
};

export { bridge };

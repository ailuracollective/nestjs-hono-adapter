import { loadPeer } from '@ailura/nestjs-hono-adapter';

import { isApolloPeer } from './peer-read.ts';
import type { ApolloPeer } from './peer-shapes.ts';

/**
 * The `@nestjs/apollo` peer, resolved the way the _application_ resolved it — the driver patched
 * here is the application's.
 */
const apolloPeer = async (): Promise<ApolloPeer | undefined> => {
  const loaded = await loadPeer('@nestjs/apollo');
  return isApolloPeer(loaded) ? loaded : undefined;
};

export { apolloPeer };

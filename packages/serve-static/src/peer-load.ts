import { loadPeer } from '@ailura/nestjs-hono-adapter';

import { isMatcherPeer, isModulePeer } from './peer-read.ts';
import type { Peers } from './peer-shapes.ts';

/**
 * Loads both peers once; the only await in the bridge. They are the application's, because the
 * loader swapped is theirs.
 */
const loadPeers = async (): Promise<Peers> => {
  const [matcher, module] = await Promise.all([
    loadPeer('path-to-regexp'),
    loadPeer('@nestjs/serve-static'),
  ]);
  return {
    pathToRegexp: isMatcherPeer(matcher) ? matcher : undefined,
    serveStatic: isModulePeer(module) ? module : undefined,
  };
};

export { loadPeers };

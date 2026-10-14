const COMPAT_INDEX = 'packages/core/src/compat/index.ts';

/**
 * The peer resolver, published so that a bridge package can load the peer it patches the way the
 * application resolved it.
 */
const BRIDGE_TOOLKIT = 'packages/core/src/compat/peer-load.ts';

export { BRIDGE_TOOLKIT, COMPAT_INDEX };
export {
  EXPRESS_SURFACE,
  EXPRESS_SURFACE_CALLER,
  coreReachesCompat,
  coreReachesFeature,
  crossing,
  layerOf,
} from './rules/layers.ts';
export {
  bridgeReachesApp,
  featureReachesFeature,
  featureReachesWs,
  multipartReachesApp,
  socketIoReachesApp,
  wsReachesApp,
} from './rules/islands.ts';

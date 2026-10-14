import { expressBridge } from './express/index.ts';
import {
  clearBridges,
  registerBridge,
} from './registry/index.ts';
import type { Bridge } from './types.ts';

/**
 * The bridges this package ships: only `express`, which shapes
 * what Nest hands a controller.
 */
const SHIPPED: readonly Bridge[] = [expressBridge];

for (const bridge of SHIPPED) {
  registerBridge(bridge);
}

/**
 * Puts the registry back to what this package ships; for the
 * tests.
 */
function resetBridges(): void {
  clearBridges();
  for (const bridge of SHIPPED) {
    registerBridge(bridge);
  }
}

export { resetBridges };
export {
  BRIDGE_PACKAGES,
  bridgeNames,
  discoverBridges,
  installBridges,
  registerBridge,
  settleBridges,
} from './registry/index.ts';
export type { Bridge, BridgeTarget } from './types.ts';

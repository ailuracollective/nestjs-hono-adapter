import { expressBridge } from './express/index.ts';
import { clearBridges, registerBridge } from './registry/index.ts';
import { clearDiscovery } from './registry/discover.ts';
import type { Bridge } from './types.ts';

const SHIPPED: readonly Bridge[] = [expressBridge];

for (const bridge of SHIPPED) {
  registerBridge(bridge);
}

function resetBridges(): void {
  clearBridges();
  clearDiscovery();
  for (const bridge of SHIPPED) {
    registerBridge(bridge);
  }
}

export { resetBridges };
export { expressErrorMiddleware } from './express/index.ts';
export {
  BRIDGE_PACKAGES,
  bridgeNames,
  discoverBridges,
  installBridges,
  registerBridge,
  settleBridges,
} from './registry/index.ts';
export type { Bridge, BridgeTarget } from './types.ts';

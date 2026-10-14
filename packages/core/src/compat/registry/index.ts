import type {
  Bridge,
  BridgeTarget,
} from '#adapter/compat/types';

import { discoverBridges } from './discover.ts';
import { installOne, track } from './settle.ts';
import { bridges } from './store.ts';

/** The bridges already installed on each application. */
const installed = new WeakMap<object, WeakSet<Bridge>>();

/**
 * Installs every bridge this application has not had yet, so
 * one discovered after the first pass is not missed.
 */
const installNew = (target: BridgeTarget): void => {
  const { hono } = target;
  const done = installed.get(hono) ?? new WeakSet<Bridge>();
  installed.set(hono, done);
  const fresh = bridges().filter((bridge) => !done.has(bridge));
  for (const bridge of fresh) {
    done.add(bridge);
    installOne(bridge, () => bridge.install(target));
  }
};

/** Installs what the discovery turns up, once it has turned up. */
const installDiscovered = async (
  target: BridgeTarget,
): Promise<void> => {
  await discoverBridges();
  installNew(target);
};

/**
 * Installs the bridges known now, and the ones discovery turns
 * up. Nothing here is asked of the deployment.
 */
function installBridges(target: BridgeTarget): void {
  installNew(target);
  track(
    installDiscovered(target),
    'The compatibility bridge discovery',
  );
}

/** The names of every bridge registered, in registration order. */
function bridgeNames(): readonly string[] {
  return bridges().map((bridge) => bridge.name);
}

export { clearBridges, registerBridge } from './store.ts';
export { settleBridges } from './settle.ts';
export {
  BRIDGE_PACKAGES,
  discoverBridges,
} from './discover.ts';
export { bridgeNames, installBridges };

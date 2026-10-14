import { loadPeer } from '#adapter/compat/peer-load';
import type { Bridge } from '#adapter/compat/types';

import { registerBridge } from './store.ts';

/**
 * The bridge packages the region looks for. Written here: the
 * adapter cannot depend on what it looks for.
 */
const BRIDGE_PACKAGES = [
  '@ailura/nestjs-platform-hono-graphql',
  '@ailura/nestjs-platform-hono-serve-static',
] as const;

/** What a bridge package publishes for this layer to find. */
interface BridgePackage {
  /** The bridge it carries. */
  readonly bridge: Bridge;
}

/** Whether a value is a `Bridge`, by shape rather than by name. */
const isBridge = (value: unknown): value is Bridge =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'name') === 'string' &&
  typeof Reflect.get(value, 'install') === 'function';

/** Whether what loaded is a package this layer can register. */
const isBridgePackage = (
  loaded: unknown,
): loaded is BridgePackage =>
  typeof loaded === 'object' &&
  loaded !== null &&
  isBridge(Reflect.get(loaded, 'bridge'));

/** The bridge one installed package publishes, or none. */
const bridgeFrom = async (
  specifier: string,
): Promise<Bridge | undefined> => {
  const loaded = await loadPeer(specifier);
  return isBridgePackage(loaded) ? loaded.bridge : undefined;
};

/** The bridge every installed bridge package publishes. */
const resolveAll = async (): Promise<readonly Bridge[]> => {
  const found = await Promise.all(
    BRIDGE_PACKAGES.map((one) => bridgeFrom(one)),
  );
  return found.filter((bridge) => bridge !== undefined);
};

/**
 * What the installed bridge packages publish, held after the
 * first resolution and read by every later one.
 */
const resolution: { bridges?: readonly Bridge[] } = {};

/**
 * The resolution, run once per process however many
 * applications start: the specifiers are imported once.
 */
const resolvePackages = async (): Promise<
  readonly Bridge[]
> => {
  const known = resolution.bridges;
  if (known !== undefined) {
    return known;
  }
  resolution.bridges = await resolveAll();
  return resolution.bridges;
};

/**
 * Registers what the packages publish, every call and not once:
 * `registerBridge()` is idempotent.
 */
const discoverBridges = async (): Promise<void> => {
  for (const bridge of await resolvePackages()) {
    registerBridge(bridge);
  }
};

export { BRIDGE_PACKAGES, discoverBridges, isBridgePackage };

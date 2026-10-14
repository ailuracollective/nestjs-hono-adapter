import { Logger } from '@nestjs/common';

import type { Bridge } from '#adapter/compat/types';

/** The bridges registered so far, in the order they arrived. */
const registered: Bridge[] = [];

/** The logger the registry reports refusals through. */
const logger = new Logger('HonoCompat');

/**
 * Registers a bridge, refusing a second under a taken name —
 * the one already there is not a second.
 */
function registerBridge(bridge: Bridge): void {
  const known = registered.find(
    (one) => one.name === bridge.name,
  );
  if (known === bridge) {
    return;
  }
  if (known !== undefined) {
    logger.warn(
      `The compatibility bridge "${bridge.name}" is already ` +
        'registered; the second one is refused.',
    );
    return;
  }
  registered.push(bridge);
}

/** The bridges registered, in registration order. */
function bridges(): readonly Bridge[] {
  return [...registered];
}

/**
 * Empties the registry; the region's index re-registers the
 * shipped set.
 */
function clearBridges(): void {
  registered.length = 0;
}

export { bridges, clearBridges, logger, registerBridge };

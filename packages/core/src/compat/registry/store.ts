import { Logger } from '@nestjs/common';

import type { Bridge } from '#adapter/compat/types';

const registered: Bridge[] = [];

const logger = new Logger('HonoCompat');

function registerBridge(bridge: Bridge): void {
  const known = registered.find((one) => one.name === bridge.name);
  if (known === bridge) return;
  if (known !== undefined) {
    logger.warn(
      `The compatibility bridge "${bridge.name}" is already ` +
        'registered; the second one is refused.',
    );
    return;
  }
  registered.push(bridge);
}

function bridges(): readonly Bridge[] {
  return [...registered];
}

function clearBridges(): void {
  registered.length = 0;
}

export { bridges, clearBridges, logger, registerBridge };

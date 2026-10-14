import { Hono } from 'hono';

import type { Bridge, BridgeTarget } from '#adapter/compat/index';
import { bunServer } from '#adapter/servers/bun';

const FAKE = 'fake';

interface CountingBridge extends Bridge {
  readonly installs: number;
  readonly seen: readonly BridgeTarget[];
}

const fakeBridge = (name: string): CountingBridge => {
  const seen: BridgeTarget[] = [];
  let installs = 0;
  return {
    install: (target) => {
      installs += 1;
      seen.push(target);
    },
    get installs(): number {
      return installs;
    },
    name,
    get seen(): readonly BridgeTarget[] {
      return seen;
    },
  };
};

const targetOver = (): BridgeTarget => ({
  hono: new Hono(),
  transport: bunServer(),
});

export { FAKE, fakeBridge, targetOver };
export type { CountingBridge };

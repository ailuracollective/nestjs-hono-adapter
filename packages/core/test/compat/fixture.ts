import { Hono } from 'hono';

import type { Bridge, BridgeTarget } from '#adapter/compat/index';
import type { Server } from '#adapter/core/ports/server';
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bridge only reads the target's identity.
  server: () => ({}) as unknown as Server,
  transport: bunServer(),
});

export { FAKE, fakeBridge, targetOver };
export type { CountingBridge };

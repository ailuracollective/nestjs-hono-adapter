import { Hono } from 'hono';

import type {
  Bridge,
  BridgeTarget,
} from '#adapter/compat/index';
import { bunServer } from '#adapter/servers/bun';

/** The name the tests register their own bridges under. */
const FAKE = 'fake';

/** A bridge that counts how many times it was installed. */
interface CountingBridge extends Bridge {
  /** How many applications it has been installed on. */
  readonly installs: number;
  /** What it was handed, one entry per install. */
  readonly seen: readonly BridgeTarget[];
}

/** A bridge that counts how many times it was installed. */
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

/** A Hono application and the default transport, to install on. */
const targetOver = (): BridgeTarget => ({
  hono: new Hono(),
  transport: bunServer(),
});

export { FAKE, fakeBridge, targetOver };
export type { CountingBridge };

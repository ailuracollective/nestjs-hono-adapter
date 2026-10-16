import type { Bridge } from '#adapter/compat/types';

import { logger } from './store.ts';

const settling: Promise<void>[] = [];

const isPending = (outcome: void | Promise<void>): outcome is Promise<void> =>
  outcome !== undefined;

const complaint = (name: string, error: unknown): string =>
  `The compatibility bridge "${name}" did not install: ${String(error)}`;

const settleQuietly = async (what: string, outcome: Promise<void>): Promise<void> => {
  try {
    await outcome;
  } catch (error) {
    logger.warn(`${what} did not run: ${String(error)}`);
  }
};

/**
 * Hands one more promise to `settleBridges()`. Discovery is tracked too: it registers what has to
 * install.
 */
const track = (outcome: Promise<void>, what: string): void => {
  settling.push(settleQuietly(what, outcome));
};

const settleOne = async (name: string, outcome: Promise<void>): Promise<void> => {
  try {
    await outcome;
  } catch (error) {
    logger.warn(complaint(name, error));
  }
};

function installOne(bridge: Bridge, run: () => void | Promise<void>): void {
  try {
    const outcome = run();
    if (isPending(outcome)) {
      settling.push(settleOne(bridge.name, outcome));
    }
  } catch (error) {
    logger.warn(complaint(bridge.name, error));
  }
}

async function settleBridges(): Promise<void> {
  await Promise.all(settling.splice(0));
  if (settling.length > 0) await settleBridges();
}

export { installOne, settleBridges, track };

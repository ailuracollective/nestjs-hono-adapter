import type { Bridge } from '#adapter/compat/types';

import { logger } from './store.ts';

/** The installs still settling, for the adapter to await. */
const settling: Promise<void>[] = [];

/** Whether an install asked to be awaited before Nest boots. */
const isPending = (
  outcome: void | Promise<void>,
): outcome is Promise<void> => outcome !== undefined;

/** Says why a bridge did not fit, in one line. */
const complaint = (name: string, error: unknown): string =>
  `The compatibility bridge "${name}" did not install: ${String(error)}`;

/** Awaits one outcome, turning its failure into a warning. */
const settleQuietly = async (
  what: string,
  outcome: Promise<void>,
): Promise<void> => {
  try {
    await outcome;
  } catch (error) {
    logger.warn(`${what} did not run: ${String(error)}`);
  }
};

/**
 * Hands one more promise to `settleBridges()`. Discovery is
 * tracked too: it registers what has to install.
 */
const track = (outcome: Promise<void>, what: string): void => {
  settling.push(settleQuietly(what, outcome));
};

/** Awaits one install, turning its failure into a warning. */
const settleOne = async (
  name: string,
  outcome: Promise<void>,
): Promise<void> => {
  try {
    await outcome;
  } catch (error) {
    logger.warn(complaint(name, error));
  }
};

/**
 * Runs one bridge's install; a failure never reaches the
 * caller.
 */
function installOne(
  bridge: Bridge,
  run: () => void | Promise<void>,
): void {
  try {
    const outcome = run();
    if (isPending(outcome)) {
      settling.push(settleOne(bridge.name, outcome));
    }
  } catch (error) {
    logger.warn(complaint(bridge.name, error));
  }
}

/**
 * Waits for the installs that asked to be awaited, draining any
 * that arrive while it waits.
 */
async function settleBridges(): Promise<void> {
  await Promise.all(settling.splice(0));
  if (settling.length > 0) {
    await settleBridges();
  }
}

export { installOne, settleBridges, track };

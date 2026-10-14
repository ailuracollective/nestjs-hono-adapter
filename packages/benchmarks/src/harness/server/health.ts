/* eslint-disable no-await-in-loop -- readiness is polled iteratively. */
/* eslint-disable promise/avoid-new -- net.Server listen requires callback. */

import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * Maximum number of health check retry attempts before timing
 * out.
 */
const READY_ATTEMPTS = 200;

/** Milliseconds interval between health check attempts. */
const READY_INTERVAL_MS = 100;

/** Finds and reserves an available ephemeral TCP port. */
const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('could not reserve a port'));
        return;
      }
      probe.close(() => {
        resolve(address.port);
      });
    });
  });

/** Probes the server health route to verify responsiveness. */
const isHealthy = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/health`,
    );
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Polls the server until /health answers or attempts are
 * exhausted.
 */
const waitForHealth = async (port: number): Promise<void> => {
  for (
    let attempt = 0;
    attempt < READY_ATTEMPTS;
    attempt += 1
  ) {
    if (await isHealthy(port)) {
      return;
    }
    await delay(READY_INTERVAL_MS);
  }
  throw new Error(`the server never answered on port ${port}`);
};

export { findFreePort, waitForHealth };

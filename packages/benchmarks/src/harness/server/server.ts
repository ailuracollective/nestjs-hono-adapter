import type { ChildProcess } from 'node:child_process';
import path from 'node:path';

import { execa } from 'execa';

import type { Target } from '#benchmarks/harness/config/index';
import { findFreePort, waitForHealth } from './health.ts';

/** Absolute path to the server-entry.js worker script. */
const serverEntry = path.join(
  import.meta.dir,
  'server-entry.js',
);

/** Active child process metadata. */
interface Running {
  /** The spawned server process. */
  readonly child: ChildProcess;
  /** Resolves once the server process exits. */
  readonly exited: Promise<unknown>;
  /** OS process id of the server, when known. */
  readonly pid: number | undefined;
  /** Port the child process is listening on. */
  readonly port: number;
}

/**
 * Spawns a server process for the target and waits until
 * healthy.
 */
const start = async (target: Target): Promise<Running> => {
  const port = await findFreePort();
  const runtime = target === 'bun' ? 'bun' : 'node';
  const process = execa(
    runtime,
    [serverEntry, target, String(port)],
    { reject: false, stdio: ['ignore', 'inherit', 'inherit'] },
  );
  await waitForHealth(port);
  return {
    child: process.nodeChildProcess,
    exited: process,
    pid: process.pid,
    port,
  };
};

/** Gracefully terminates the running server process. */
const stop = async (running: Running): Promise<void> => {
  running.child.kill('SIGTERM');
  await running.exited;
};

export type { Running };
export { start, stop };

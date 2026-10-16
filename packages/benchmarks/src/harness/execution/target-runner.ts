/* eslint-disable no-await-in-loop -- sequential target runs avoid contention. */

import { setTimeout as delay } from 'node:timers/promises';

import type { Options, Sample, Scenario, Target } from '#benchmarks/harness/config/index';
import { start, stop } from '#benchmarks/harness/server/server';
import { collect, sweepFor } from './sweep.ts';

/** Cooldown in milliseconds between consecutive target executions. */
const SETTLE_MS = 500;

/** Starts target server, executes measurements, and terminates it. */
const runTarget = async (
  target: Target,
  options: Options,
  selected: readonly Scenario[],
): Promise<Sample[]> => {
  const running = await start(target);
  try {
    return await collect(
      sweepFor({
        options,
        pid: running.pid,
        port: running.port,
        selected,
        target,
      }),
    );
  } finally {
    await stop(running);
  }
};

/** Executes measurements across all specified target servers. */
const runTargets = async (options: Options, selected: readonly Scenario[]): Promise<Sample[]> => {
  const samples: Sample[] = [];
  for (const target of options.targets) {
    process.stdout.write(`\n=== ${target} ===\n`);
    samples.push(...(await runTarget(target, options, selected)));
    await delay(SETTLE_MS);
  }
  return samples;
};

export { runTargets };

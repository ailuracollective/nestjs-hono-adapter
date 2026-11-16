/* eslint-disable no-await-in-loop -- sequential target runs avoid contention. */

import { setTimeout as delay } from 'node:timers/promises';

import type { App, Options, Sample, Scenario, Target } from '#benchmarks/harness/config/index';
import type { Running } from '#benchmarks/harness/server/server';
import { start, stop } from '#benchmarks/harness/server/server';
import { collect, sweepFor } from './sweep.ts';

/** Cooldown in milliseconds between consecutive target executions. */
const SETTLE_MS = 500;

/** Returns the application variants the selected scenarios need, in stable order. */
const appsFor = (selected: readonly Scenario[]): readonly App[] => {
  const apps: App[] = [];
  for (const scenario of selected) {
    if (!apps.includes(scenario.app)) apps.push(scenario.app);
  }
  return apps;
};

/** Starts every server the target needs, executes measurements, and terminates them. */
const runTarget = async (
  target: Target,
  options: Options,
  selected: readonly Scenario[],
): Promise<Sample[]> => {
  const running = new Map<App, Running>();
  try {
    for (const app of appsFor(selected)) {
      running.set(app, await start(target, app));
    }
    return await collect(sweepFor({ options, selected, servers: running, target }));
  } finally {
    for (const server of running.values()) {
      await stop(server);
    }
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

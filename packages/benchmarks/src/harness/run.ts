import path from 'node:path';

import { parseArgs, usage } from './cli/args.ts';
import type { Options, ReportContext, ReportPayload, Scenario } from './config/index.ts';
import { runTargets } from './execution/target-runner.ts';
import { meta } from './meta/meta.ts';
import type { ReportTargets } from './report/index.ts';
import { report, summarize } from './report/index.ts';
import { scenarios } from './scenarios/scenarios.ts';

/** Start offset of user arguments in process.argv. */
const ARGV_START = 2;

/** Absolute path to the benchmarks package root. */
const packageDir = path.join(import.meta.dir, '..', '..');

/** Absolute path to the repository root. */
const repositoryDir = path.join(packageDir, '..', '..');

/** Destinations the report writes its artifacts to. */
const reportTargets: ReportTargets = {
  docs: path.join(repositoryDir, 'docs'),
  results: path.join(packageDir, 'results'),
};

/** Filters the active scenarios based on command line options. */
const selectionOf = (options: Options): readonly Scenario[] => {
  const selected = scenarios.filter((scenario) => options.scenarioIds.includes(scenario.id));
  if (selected.length === 0) {
    throw new Error('no scenario matched --scenarios');
  }
  return selected;
};

/** Constructs the report layout context from payload and options. */
const contextOf = (
  payload: ReportPayload,
  options: Options,
  selected: readonly Scenario[],
): ReportContext => ({
  scenarios: selected.map((scenario) => scenario.id),
  summaries: payload.summaries,
  targets: options.targets,
});

/** Orchestrates target runs, sample collection, and summarization. */
const run = async (options: Options, selected: readonly Scenario[]): Promise<ReportPayload> => {
  const samples = await runTargets(options, selected);
  const summaries = summarize(samples);
  return { meta: await meta(options), samples, summaries };
};

/** Main entry point for the benchmark suite orchestrator. */
const main = async (): Promise<void> => {
  const parsed = parseArgs(process.argv.slice(ARGV_START));
  if (parsed === 'help') {
    process.stdout.write(usage);
    return;
  }
  const selected = selectionOf(parsed);
  const payload = await run(parsed, selected);
  await report(payload, contextOf(payload, parsed, selected), reportTargets);
  process.stdout.write(`\nWrote ${reportTargets.docs} and ${reportTargets.results}\n`);
};

// oxlint-disable-next-line node/no-top-level-await -- standalone CLI script.
await main();

import type { Command } from 'commander';
import { Option } from 'commander';

import {
  ALL_TARGETS,
  DEFAULT_CONNECTIONS,
  DEFAULT_DURATION,
  DEFAULT_RUNS,
  DEFAULT_TOOL,
  DEFAULT_WARMUP,
} from '#benchmarks/harness/config/index';
import { scenarios } from '#benchmarks/harness/scenarios/scenarios';
import {
  parsePositiveNumber,
  parseScenarios,
  parseTargets,
} from './parsers.ts';

/** Registers targets, scenarios, and tool options. */
const addExecutionOptions = (program: Command): void => {
  program
    .addOption(
      new Option(
        '-t, --targets <targets>',
        'targets to run (bun, node, express, fastify)',
      )
        .default([...ALL_TARGETS], 'all')
        .argParser(parseTargets),
    )
    .addOption(
      new Option(
        '-s, --scenarios <scenarios>',
        'scenarios to run',
      )
        .default(
          scenarios.map((scenario) => scenario.id),
          'all',
        )
        .argParser(parseScenarios),
    )
    .addOption(
      new Option('--tool <tool>', 'load generator')
        .choices(['oha', 'bombardier', 'both'])
        .default(DEFAULT_TOOL),
    );
};

/** Registers connection, duration, warmup, and run options. */
const addMeasurementOptions = (program: Command): void => {
  program
    .addOption(
      new Option(
        '-c, --connections <number>',
        'concurrent connections',
      )
        .default(DEFAULT_CONNECTIONS)
        .argParser((val) =>
          parsePositiveNumber(val, 'connections'),
        ),
    )
    .addOption(
      new Option(
        '-d, --duration <seconds>',
        'measured seconds per run',
      )
        .default(DEFAULT_DURATION)
        .argParser((val) =>
          parsePositiveNumber(val, 'duration'),
        ),
    )
    .addOption(
      new Option(
        '-w, --warmup <seconds>',
        'warmup seconds per scenario',
      )
        .default(DEFAULT_WARMUP)
        .argParser((val) => parsePositiveNumber(val, 'warmup')),
    )
    .addOption(
      new Option(
        '-r, --runs <count>',
        'measured runs per scenario',
      )
        .default(DEFAULT_RUNS)
        .argParser((val) => parsePositiveNumber(val, 'runs')),
    );
};

export { addExecutionOptions, addMeasurementOptions };

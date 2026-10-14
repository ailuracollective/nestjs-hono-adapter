import type {
  Options,
  Target,
} from '#benchmarks/harness/config/index';
import { resolveTools } from './parsers.ts';
import { buildProgram } from './program.ts';

/** Raw parsed CLI option values from Commander. */
interface ParsedValues {
  /** Concurrent connections count. */
  readonly connections: number;
  /** Measured seconds per run. */
  readonly duration: number;
  /** Measured runs per scenario. */
  readonly runs: number;
  /** Scenarios to execute. */
  readonly scenarios: readonly string[];
  /** Server targets to test. */
  readonly targets: readonly Target[];
  /** Raw tool selection string. */
  readonly tool: string;
  /** Warmup seconds per scenario. */
  readonly warmup: number;
}

/** Pre-built program instance to extract help information. */
const program = buildProgram();

/** Formatted usage help string. */
const usage = program.helpInformation();

/** Checks whether an error represents a requested help exit. */
const isHelpError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'commander.helpDisplayed';

/**
 * Parses raw argv strings into structured Options or help
 * signal.
 */
const parseArgs = (
  argv: readonly string[],
): Options | 'help' => {
  const cli = buildProgram();
  try {
    cli.parse(argv, { from: 'user' });
  } catch (error: unknown) {
    if (isHelpError(error)) {
      return 'help';
    }
    throw error;
  }

  const values = cli.opts<ParsedValues>();
  return {
    connections: values.connections,
    durationSeconds: values.duration,
    runs: values.runs,
    scenarioIds: values.scenarios,
    targets: values.targets,
    tools: resolveTools(values.tool),
    warmupSeconds: values.warmup,
  };
};

export { parseArgs, usage };

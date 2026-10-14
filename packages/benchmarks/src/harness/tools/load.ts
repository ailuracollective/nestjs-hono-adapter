import type {
  LoadResult,
  Scenario,
  Tool,
} from '#benchmarks/harness/config/index';
import { parseBombardier } from './bombardier.ts';
import { runCommand } from './command.ts';
import { parseOha } from './oha.ts';
import { bombardierArgs, ohaArgs } from './tool-args.ts';

/** Parameters required to measure a scenario using a tool. */
interface LoadOptions {
  /** Concurrent connections count. */
  readonly connections: number;
  /** Duration in seconds. */
  readonly durationSeconds: number;
  /** Scenario request definition. */
  readonly scenario: Scenario;
  /** Tool to drive. */
  readonly tool: Tool;
  /** Destination endpoint URL. */
  readonly url: string;
}

/** Drives one load tool for one duration and parses its report. */
const measure = async (
  options: LoadOptions,
): Promise<LoadResult> => {
  const { tool } = options;
  const args =
    tool === 'oha' ? ohaArgs(options) : bombardierArgs(options);
  const result = await runCommand(tool, args);
  if (result.code !== 0) {
    throw new Error(
      `${tool} exited with ${String(result.code)}:\n${result.stderr}`,
    );
  }
  return tool === 'oha'
    ? parseOha(result.stdout)
    : parseBombardier(result.stdout);
};

export type { LoadOptions };
export { runCommand } from './command.ts';
export { measure };

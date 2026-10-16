import { cpus } from 'node:os';

import type { Options, RunMeta, Tool } from '#benchmarks/harness/config/index';
import { runCommand } from '#benchmarks/harness/tools/load';

/** Queries installed versions of the specified load generator tools. */
const toolVersions = async (tools: readonly Tool[]): Promise<Record<string, string>> => {
  const lines = await Promise.all(
    tools.map(async (tool) => {
      const { stderr, stdout } = await runCommand(tool, ['--version']);
      return [tool, (stdout || stderr).split('\n').at(0) ?? ''] as const;
    }),
  );
  return Object.fromEntries(lines);
};

/** Leading `v` in `node --version` output. */
const VERSION_V = /^v/u;

/**
 * Reads the Node.js version from the binary the targets run on, falling back to the runtime's own
 * compatibility value.
 */
const nodeVersion = async (): Promise<string> => {
  try {
    const { stdout } = await runCommand('node', ['--version']);
    return stdout.trim().replace(VERSION_V, '') || process.versions.node;
  } catch {
    return process.versions.node;
  }
};

/** Collects hardware, platform, tool, and options metadata. */
const meta = async (options: Options): Promise<RunMeta> => {
  const [first] = cpus();
  return {
    bun: process.versions.bun,
    connections: options.connections,
    cores: cpus().length,
    cpu: first === undefined ? 'unknown' : first.model,
    date: new Date().toISOString(),
    durationSeconds: options.durationSeconds,
    node: await nodeVersion(),
    runs: options.runs,
    tools: await toolVersions(options.tools),
    warmupSeconds: options.warmupSeconds,
  };
};

export { meta };

import { execa } from 'execa';

/** Sentinel index when a character pattern is not found. */
const NOT_FOUND = -1;

/** Opening curly brace marking the start of a JSON payload. */
const JSON_START = '{';

/** Result of a child process command execution. */
interface CommandResult {
  /** Process exit code. */
  readonly code: number;
  /** Captured standard error stream. */
  readonly stderr: string;
  /** Captured standard output stream. */
  readonly stdout: string;
}

/**
 * Runs a command and captures its exit code and output streams.
 *
 * A tool that never produced an exit code either is missing
 * from `PATH` or was terminated by a signal; both are reported
 * instead of a bare undefined code.
 */
const runCommand = async (
  command: string,
  args: readonly string[],
): Promise<CommandResult> => {
  const {
    exitCode,
    isTerminated,
    originalMessage,
    stderr,
    stdout,
  } = await execa(command, args, { reject: false });
  if (exitCode === undefined) {
    throw new Error(
      isTerminated
        ? `${command} was terminated by a signal`
        : `could not run ${command}; install it or put it on PATH (${originalMessage})`,
    );
  }
  return { code: exitCode, stderr, stdout };
};

/**
 * Extracts the JSON substring from raw tool output by locating
 * '{'.
 */
const jsonFrom = (raw: string): string => {
  const start = raw.indexOf(JSON_START);
  if (start === NOT_FOUND) {
    throw new Error(`no JSON in tool output:\n${raw}`);
  }
  return raw.slice(start);
};

/**
 * Reads an optional numeric percentile from a record,
 * defaulting to 0.
 */
const pick = (
  record: Readonly<Record<string, number>> | undefined,
  key: string,
): number => {
  if (record === undefined) {
    return 0;
  }
  return record[key] ?? 0;
};

export type { CommandResult };
export { jsonFrom, pick, runCommand };

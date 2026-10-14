import pidusage from 'pidusage';

import type { ProcessSample } from './types.ts';

/** Reads a process's cumulative CPU time and current RSS. */
const readSample = async (
  pid: number,
): Promise<ProcessSample> => {
  const stats = await pidusage(pid);
  return { cpuMillis: stats.ctime, rssBytes: stats.memory };
};

/** Computes the arithmetic mean of a list, or 0 when empty. */
const mean = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return values.length === 0 ? 0 : total / values.length;
};

/** Computes the largest value of a list, or 0 when empty. */
const peak = (values: readonly number[]): number => {
  let largest = 0;
  for (const value of values) {
    if (value > largest) {
      largest = value;
    }
  }
  return largest;
};

export { mean, peak, readSample };

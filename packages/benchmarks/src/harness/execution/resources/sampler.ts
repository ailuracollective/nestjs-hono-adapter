/* eslint-disable no-await-in-loop -- resource polling samples sequentially. */

import { setTimeout as delay } from 'node:timers/promises';

import { mean, peak, readSample } from './probe.ts';
import type { ProcessSample, ResourceSample } from './types.ts';

/** Milliseconds between consecutive resource samples. */
const POLL_INTERVAL_MS = 250;

/** Percent scaling factor. */
const PERCENT = 100;

/** A completed task paired with the usage it consumed. */
interface Sampled<Value> {
  /** Value the sampled task resolved to. */
  readonly result: Value;
  /** Usage over the task's window, when measurable. */
  readonly usage: ResourceSample | undefined;
}

/** Mutable state of an open measurement window. */
interface OpenWindow {
  /** First reading, taken before the task starts. */
  readonly start: ProcessSample;
  /** RSS readings collected so far. */
  readonly memories: number[];
  /** Wall clock when the window opened, in milliseconds. */
  readonly startedAt: number;
}

/** Aggregation inputs of one closed measurement window. */
interface ClosedWindow {
  /** First reading, taken before the task started. */
  readonly start: ProcessSample;
  /** Last reading, taken after the task resolved. */
  readonly end: ProcessSample;
  /** RSS readings collected during the window. */
  readonly memories: readonly number[];
  /** Wall time of the window, in milliseconds. */
  readonly elapsedMillis: number;
}

/** Reads one sample, or nothing when the process is gone. */
const readSampleOrUndefined = async (pid: number): Promise<ProcessSample | undefined> => {
  try {
    return await readSample(pid);
  } catch {
    return undefined;
  }
};

/** Polls the process RSS until stopped or the process disappears. */
const pollRss = async (pid: number, memories: number[], stopped: () => boolean): Promise<void> => {
  while (!stopped()) {
    await delay(POLL_INTERVAL_MS);
    if (stopped()) {
      break;
    }
    const sample = await readSampleOrUndefined(pid);
    if (sample === undefined) {
      break;
    }
    memories.push(sample.rssBytes);
  }
};

/** Opens a measurement window with its first reading. */
const openWindow = (start: ProcessSample): OpenWindow => ({
  memories: [start.rssBytes],
  start,
  startedAt: performance.now(),
});

/** Aggregates raw readings into one window's resource usage. */
const summarize = (window: ClosedWindow): ResourceSample => {
  const cpuMillis = Math.max(window.end.cpuMillis - window.start.cpuMillis, 0);
  return {
    cpuMillis,
    cpuPercent: window.elapsedMillis > 0 ? (cpuMillis / window.elapsedMillis) * PERCENT : 0,
    rssMeanBytes: mean(window.memories),
    rssPeakBytes: peak(window.memories),
  };
};

/** Closes a window and summarizes its usage, or nothing. */
const closeWindow = async (
  pid: number,
  window: OpenWindow,
): Promise<ResourceSample | undefined> => {
  const end = await readSampleOrUndefined(pid);
  if (end === undefined) {
    return undefined;
  }
  window.memories.push(end.rssBytes);
  return summarize({
    elapsedMillis: performance.now() - window.startedAt,
    end,
    memories: window.memories,
    start: window.start,
  });
};

/** Polls a running task and summarizes its window usage. */
const measureWindow = async <Value>(
  pid: number,
  window: OpenWindow,
  task: () => Promise<Value>,
): Promise<Sampled<Value>> => {
  let stop = false;
  const poll = pollRss(pid, window.memories, () => stop);
  try {
    const result = await task();
    const usage = await closeWindow(pid, window);
    return { result, usage };
  } finally {
    stop = true;
    await poll;
  }
};

/**
 * Runs a task while polling a process's CPU and memory, so the returned usage covers exactly the
 * task's window.
 *
 * Sampling is best effort: a process that cannot be read on this platform yields no usage rather
 * than failing the run.
 */
const sampleResources = async <Value>(
  pid: number | undefined,
  task: () => Promise<Value>,
): Promise<Sampled<Value>> => {
  if (pid !== undefined) {
    const start = await readSampleOrUndefined(pid);
    if (start !== undefined) {
      return measureWindow(pid, openWindow(start), task);
    }
  }
  return { result: await task(), usage: undefined };
};

export type { Sampled };
export { sampleResources };

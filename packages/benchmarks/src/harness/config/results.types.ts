import type { Target, Tool } from './env.types.ts';

/** Latency distribution in milliseconds. */
interface LatencyMs {
  /** Maximum latency recorded. */
  readonly max: number;
  /** Mean average latency. */
  readonly mean: number;
  /** Minimum latency recorded. */
  readonly min: number;
  /** 50th percentile (median) latency. */
  readonly p50: number;
  /** 90th percentile latency. */
  readonly p90: number;
  /** 95th percentile latency. */
  readonly p95: number;
  /** 99th percentile latency. */
  readonly p99: number;
}

/** Metrics from a single measured run. */
interface LoadResult {
  /** Transfer rate in bytes per second. */
  readonly bytesPerSecond: number;
  /** Count of non-2xx/3xx HTTP responses. */
  readonly errors: number;
  /** Latency percentiles breakdown. */
  readonly latencyMs: LatencyMs;
  /** Throughput in requests per second. */
  readonly requestsPerSecond: number;
  /** Total requests answered. */
  readonly total: number;
}

/** One sample of a scenario on a target by a tool. */
interface Sample {
  /** Load result measurements. */
  readonly result: LoadResult;
  /** Zero-indexed iteration number. */
  readonly run: number;
  /** Scenario identifier. */
  readonly scenario: string;
  /** Server implementation target. */
  readonly target: Target;
  /** Load generator tool used. */
  readonly tool: Tool;
}

/** Aggregated median results of repeated runs. */
interface Summary {
  /** Median error count. */
  readonly errors: number;
  /** Median latency distribution. */
  readonly latencyMs: LatencyMs;
  /** Median throughput in requests per second. */
  readonly requestsPerSecond: number;
  /** Total count of measured runs. */
  readonly runs: number;
  /** Scenario identifier. */
  readonly scenario: string;
  /** Server implementation target. */
  readonly target: Target;
  /** Load generator tool used. */
  readonly tool: Tool;
}

export type { LatencyMs, LoadResult, Sample, Summary };

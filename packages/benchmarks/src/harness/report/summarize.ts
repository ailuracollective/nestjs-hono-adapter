import type {
  LatencyMs,
  ResourceUsage,
  Sample,
  Summary,
} from '#benchmarks/harness/config/index';

/** Divisor used to calculate median of an even number of values. */
const HALF = 2;

/** Calculates the numerical median of an array of numbers. */
const median = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].toSorted(
    (left, right) => left - right,
  );
  const middle = Math.floor(sorted.length / HALF);
  if (sorted.length % HALF === 1) {
    return sorted[middle] ?? 0;
  }
  return (
    ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / HALF
  );
};

/** Computes the median of a specific latency percentile key. */
const medianLatency = (
  samples: readonly Sample[],
  key: keyof LatencyMs,
): number =>
  median(samples.map((sample) => sample.result.latencyMs[key]));

/** Aggregates all latency percentiles into their medians. */
const summarizeLatency = (
  samples: readonly Sample[],
): LatencyMs => ({
  max: medianLatency(samples, 'max'),
  mean: medianLatency(samples, 'mean'),
  min: medianLatency(samples, 'min'),
  p50: medianLatency(samples, 'p50'),
  p90: medianLatency(samples, 'p90'),
  p95: medianLatency(samples, 'p95'),
  p99: medianLatency(samples, 'p99'),
});

/** Groups raw samples by target, scenario, and tool. */
const groupSamples = (
  samples: readonly Sample[],
): Map<string, Sample[]> => {
  const groups = new Map<string, Sample[]>();
  for (const sample of samples) {
    const key = `${sample.target}\u0000${sample.scenario}\u0000${sample.tool}`;
    const list = groups.get(key) ?? [];
    list.push(sample);
    groups.set(key, list);
  }
  return groups;
};

/** Aggregates per-run resource usage into its medians. */
const summarizeResources = (
  samples: readonly Sample[],
): ResourceUsage | undefined => {
  const present = samples.flatMap((sample) =>
    sample.resources === undefined ? [] : [sample.resources],
  );
  if (present.length === 0) {
    return undefined;
  }
  return {
    cpuMsPerRequest: median(
      present.map((usage) => usage.cpuMsPerRequest),
    ),
    cpuPercent: median(
      present.map((usage) => usage.cpuPercent),
    ),
    rssMeanBytes: median(
      present.map((usage) => usage.rssMeanBytes),
    ),
    rssPeakBytes: median(
      present.map((usage) => usage.rssPeakBytes),
    ),
  };
};

/** Computes median summary for a grouped list of samples. */
const summarizeGroup = (list: readonly Sample[]): Summary => {
  const [first] = list;
  if (first === undefined) {
    throw new Error('a sample group is never empty');
  }
  return {
    errors: median(list.map((sample) => sample.result.errors)),
    latencyMs: summarizeLatency(list),
    requestsPerSecond: median(
      list.map((sample) => sample.result.requestsPerSecond),
    ),
    resources: summarizeResources(list),
    runs: list.length,
    scenario: first.scenario,
    target: first.target,
    tool: first.tool,
  };
};

/** Collapses repeated run samples into their median Summary. */
const summarize = (samples: readonly Sample[]): Summary[] =>
  [...groupSamples(samples).values()].map((list) =>
    summarizeGroup(list),
  );

export { median, summarize };

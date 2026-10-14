import type { LoadResult } from '#benchmarks/harness/config/index';
import { jsonFrom, pick } from './command.ts';

/** Lowest HTTP status code considered successful. */
const SUCCESS_MIN = 200;

/** Lowest HTTP status code considered an error. */
const ERROR_MIN = 400;

/** Conversion factor from seconds to milliseconds. */
const MILLIS_PER_SECOND = 1000;

/** Aggregated HTTP response status counts. */
interface StatusTotals {
  /** Count of non-2xx/3xx error responses. */
  readonly errors: number;
  /** Total responses parsed. */
  readonly total: number;
}

/**
 * Sums status code distribution map into total and error
 * counts.
 */
const statusTotals = (
  distribution: Readonly<Record<string, number>> | undefined,
): StatusTotals => {
  let total = 0;
  let errors = 0;
  for (const [code, count] of Object.entries(
    distribution ?? {},
  )) {
    const numeric = Number(code);
    total += count;
    if (
      Number.isNaN(numeric) ||
      numeric < SUCCESS_MIN ||
      numeric >= ERROR_MIN
    ) {
      errors += count;
    }
  }
  return { errors, total };
};

/** Schema of oha --output-format json report. */
interface OhaReport {
  /** Latency percentiles in seconds. */
  readonly latencyPercentiles: Record<string, number>;
  /** Metrics containing throughput and latency in milliseconds. */
  readonly metrics: {
    readonly latency_ms: {
      readonly max: number;
      readonly mean: number;
      readonly min: number;
      readonly p50: number;
      readonly p95: number;
      readonly p99: number;
    };
    readonly requests_per_sec: number;
  };
  /** Status code frequency distribution. */
  readonly statusCodeDistribution?: Record<string, number>;
  /** Overall summary metrics. */
  readonly summary: { readonly sizePerSec: number };
}

/** Parses raw oha JSON output into a normalized LoadResult. */
const parseOha = (raw: string): LoadResult => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external JSON contract.
  const data = JSON.parse(
    jsonFrom(raw),
  ) as unknown as OhaReport;
  const { errors, total } = statusTotals(
    data.statusCodeDistribution,
  );
  return {
    bytesPerSecond: data.summary.sizePerSec,
    errors,
    latencyMs: {
      max: data.metrics.latency_ms.max,
      mean: data.metrics.latency_ms.mean,
      min: data.metrics.latency_ms.min,
      p50: data.metrics.latency_ms.p50,
      p90:
        pick(data.latencyPercentiles, 'p90') *
        MILLIS_PER_SECOND,
      p95: data.metrics.latency_ms.p95,
      p99: data.metrics.latency_ms.p99,
    },
    requestsPerSecond: data.metrics.requests_per_sec,
    total,
  };
};

export { parseOha };

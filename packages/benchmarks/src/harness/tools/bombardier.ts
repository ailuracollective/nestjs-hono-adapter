import type { LatencyMs, LoadResult } from '#benchmarks/harness/config/index';
import { jsonFrom, pick } from './command.ts';

/** Conversion factor from microseconds to milliseconds. */
const MICROS_PER_MILLISECOND = 1000;

/** Schema of bombardier -o json report. */
interface BombardierReport {
  /** Nested result payload. */
  readonly result: {
    /** Total bytes read across all responses. */
    readonly bytesRead: number;
    /** Latency metrics in microseconds. */
    readonly latency: {
      /** Maximum latency in microseconds. */
      readonly max: number;
      /** Mean latency in microseconds. */
      readonly mean: number;
      /** Percentiles mapping in microseconds. */
      readonly percentiles: Record<string, number>;
    };
    /** Count of other unclassified responses. */
    readonly others: number;
    /** 1xx response count. */
    readonly req1xx: number;
    /** 2xx response count. */
    readonly req2xx: number;
    /** 3xx response count. */
    readonly req3xx: number;
    /** 4xx response count. */
    readonly req4xx: number;
    /** 5xx response count. */
    readonly req5xx: number;
    /** Requests per second metrics. */
    readonly rps: { readonly mean: number };
    /** Total duration in seconds. */
    readonly timeTakenSeconds: number;
  };
}

/** Converts bombardier microsecond latencies into milliseconds. */
const bombardierLatency = (latency: BombardierReport['result']['latency']): LatencyMs => ({
  max: latency.max / MICROS_PER_MILLISECOND,
  mean: latency.mean / MICROS_PER_MILLISECOND,
  min: 0,
  p50: pick(latency.percentiles, '50') / MICROS_PER_MILLISECOND,
  p90: pick(latency.percentiles, '90') / MICROS_PER_MILLISECOND,
  p95: pick(latency.percentiles, '95') / MICROS_PER_MILLISECOND,
  p99: pick(latency.percentiles, '99') / MICROS_PER_MILLISECOND,
});

/** Parses raw bombardier JSON output into a normalized LoadResult. */
const parseBombardier = (raw: string): LoadResult => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- external JSON contract.
  const { result } = JSON.parse(jsonFrom(raw)) as unknown as BombardierReport;
  return {
    bytesPerSecond: result.timeTakenSeconds > 0 ? result.bytesRead / result.timeTakenSeconds : 0,
    errors: result.req4xx + result.req5xx + result.others,
    latencyMs: bombardierLatency(result.latency),
    requestsPerSecond: result.rps.mean,
    total:
      result.req1xx + result.req2xx + result.req3xx + result.req4xx + result.req5xx + result.others,
  };
};

export { parseBombardier };

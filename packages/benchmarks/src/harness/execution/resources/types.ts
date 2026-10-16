/** One instantaneous reading of a server process. */
interface ProcessSample {
  /** Cumulative user plus system CPU time in milliseconds. */
  readonly cpuMillis: number;
  /** Resident set size in bytes. */
  readonly rssBytes: number;
}

/** Resource usage aggregated over one measured window. */
interface ResourceSample {
  /** Cumulative CPU time consumed during the window. */
  readonly cpuMillis: number;
  /** Mean CPU usage, percent of one logical core. */
  readonly cpuPercent: number;
  /** Mean resident set size in bytes. */
  readonly rssMeanBytes: number;
  /** Peak resident set size in bytes. */
  readonly rssPeakBytes: number;
}

export type { ProcessSample, ResourceSample };

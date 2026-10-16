import type { ResourceUsage } from '#benchmarks/harness/config/index';
import type { ResourceSample } from './types.ts';

/**
 * Converts a raw resource sample into the reported usage, deriving the per-request CPU cost from
 * the answered requests.
 */
const toResourceUsage = (
  sample: ResourceSample | undefined,
  requests: number,
): ResourceUsage | undefined => {
  if (sample === undefined) {
    return undefined;
  }
  return {
    cpuMsPerRequest: requests > 0 ? sample.cpuMillis / requests : 0,
    cpuPercent: sample.cpuPercent,
    rssMeanBytes: sample.rssMeanBytes,
    rssPeakBytes: sample.rssPeakBytes,
  };
};

export { toResourceUsage };

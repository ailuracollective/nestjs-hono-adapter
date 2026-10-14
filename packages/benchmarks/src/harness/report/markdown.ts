import type {
  ReportContext,
  ResourceUsage,
  RunMeta,
  Summary,
} from '#benchmarks/harness/config/index';
import { ABSENT, format, matrix, table } from './table.ts';

/** Decimal precision digits for latency values. */
const LATENCY_DIGITS = 2;

/** Decimal precision digits for CPU percent values. */
const CPU_PERCENT_DIGITS = 1;

/** Decimal precision digits for per-request CPU cost values. */
const CPU_COST_DIGITS = 3;

/** Decimal precision digits for mebibyte memory values. */
const MEMORY_DIGITS = 1;

/** Bytes in one kibibyte. */
const KIB_BYTES = 1024;

/** Bytes in one mebibyte. */
const MIB_BYTES = KIB_BYTES * KIB_BYTES;

/**
 * Renders the load tool version line, or nothing when no
 * version was captured. Each captured line already names its
 * tool.
 */
const toolLine = (
  tools: Readonly<Record<string, string>>,
): string[] => {
  const versions = Object.values(tools)
    .map((version) => version.trim())
    .filter((version) => version.length > 0);
  return versions.length === 0
    ? []
    : [`Tools: ${versions.join(', ')}.`];
};

/** Builds header metadata lines for markdown report. */
const headerLines = (meta: RunMeta): string[] => [
  '# NestJS adapter benchmark',
  '',
  `Measured ${meta.date} on ${meta.cpu} with ${meta.cores} logical cores.`,
  `Bun ${meta.bun}, Node ${meta.node}.`,
  `Connections ${meta.connections}, duration ${meta.durationSeconds}s, ` +
    `warmup ${meta.warmupSeconds}s, ${meta.runs} runs, medians reported.`,
  ...toolLine(meta.tools),
  '',
  'All targets serve the same Nest application; only the HTTP adapter ' +
    'and runtime change. Results from one machine are comparative, ' +
    'not absolute.',
  '',
  'Regenerate from the repository root with `bun run bench`.',
  '',
];

/** Extracts unique sorted tool names from summaries. */
const toolsOf = (summaries: readonly Summary[]): string[] =>
  [
    ...new Set(summaries.map((summary) => summary.tool)),
  ].toSorted();

/** One resource metric rendered as its own table row set. */
interface ResourceMetric {
  /** Decimal precision digits. */
  readonly digits: number;
  /** Table caption. */
  readonly label: string;
  /** Reads the metric from a usage record. */
  readonly read: (usage: ResourceUsage) => number;
}

/** Resource metrics shown for every tool that recorded usage. */
const RESOURCE_METRICS: readonly ResourceMetric[] = [
  {
    digits: CPU_PERCENT_DIGITS,
    label: 'CPU, median percent of one core:',
    read: (usage) => usage.cpuPercent,
  },
  {
    digits: CPU_COST_DIGITS,
    label: 'CPU cost, median milliseconds per request:',
    read: (usage) => usage.cpuMsPerRequest,
  },
  {
    digits: MEMORY_DIGITS,
    label: 'Memory, median mean RSS in mebibytes:',
    read: (usage) => usage.rssMeanBytes / MIB_BYTES,
  },
  {
    digits: MEMORY_DIGITS,
    label: 'Memory, median peak RSS in mebibytes:',
    read: (usage) => usage.rssPeakBytes / MIB_BYTES,
  },
];

/** Renders one resource table. */
const resourceTable = (
  context: ReportContext,
  metric: ResourceMetric,
): string[] => [
  metric.label,
  '',
  ...table(
    matrix(context, (summary) =>
      summary.resources === undefined
        ? ABSENT
        : format(metric.read(summary.resources), metric.digits),
    ),
    context.targets,
  ),
  '',
];

/**
 * Builds the resource tables for a tool, when any run has
 * usage.
 */
const resourceSection = (context: ReportContext): string[] =>
  context.summaries.every(
    (summary) => summary.resources === undefined,
  )
    ? []
    : RESOURCE_METRICS.flatMap((metric) =>
        resourceTable(context, metric),
      );

/** Generates markdown section lines for a specific load tool. */
const toolSection = (
  context: ReportContext,
  tool: string,
): string[] => {
  const summaries = context.summaries.filter(
    (summary) => summary.tool === tool,
  );
  const forTool: ReportContext = {
    scenarios: context.scenarios,
    summaries,
    targets: context.targets,
  };
  return [
    `## ${tool}`,
    '',
    'Throughput, median requests per second:',
    '',
    ...table(
      matrix(forTool, (summary) =>
        format(summary.requestsPerSecond),
      ),
      context.targets,
    ),
    '',
    'Latency, median p99 in milliseconds:',
    '',
    ...table(
      matrix(forTool, (summary) =>
        format(summary.latencyMs.p99, LATENCY_DIGITS),
      ),
      context.targets,
    ),
    '',
    'Errors, median count (`error` and a 418 are expected there):',
    '',
    ...table(
      matrix(forTool, (summary) => format(summary.errors)),
      context.targets,
    ),
    '',
    ...resourceSection(forTool),
  ];
};

/** Renders complete markdown report from context and metadata. */
const toMarkdown = (
  context: ReportContext,
  meta: RunMeta,
): string => {
  const lines = [...headerLines(meta)];
  for (const tool of toolsOf(context.summaries)) {
    lines.push(...toolSection(context, tool));
  }
  return `${lines.join('\n')}\n`;
};

export { toMarkdown };

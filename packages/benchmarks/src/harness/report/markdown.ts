import type {
  ReportContext,
  RunMeta,
  Summary,
} from '#benchmarks/harness/config/index';
import { format, matrix, table } from './table.ts';

/** Decimal precision digits for latency values. */
const LATENCY_DIGITS = 2;

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

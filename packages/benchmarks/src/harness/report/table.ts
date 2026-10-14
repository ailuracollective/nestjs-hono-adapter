import type {
  ReportContext,
  Summary,
  Target,
} from '#benchmarks/harness/config/index';

/** Em dash placeholder for absent cell data. */
const ABSENT = '—';

/** Formats a number with locale digits. */
const format = (value: number, digits = 0): string =>
  value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

/** Table column holding formatted values by target. */
interface Column {
  /** Map of target names to formatted result strings. */
  readonly byTarget: ReadonlyMap<Target, string>;
  /** Scenario identifier for this row. */
  readonly scenario: string;
}

/** Formats cell values across targets for a single scenario row. */
const rowFor = (
  context: ReportContext,
  scenario: string,
  value: (summary: Summary) => string,
): ReadonlyMap<Target, string> => {
  const byTarget = new Map<Target, string>();
  for (const target of context.targets) {
    const match = context.summaries.find(
      (summary) =>
        summary.scenario === scenario &&
        summary.target === target,
    );
    byTarget.set(
      target,
      match === undefined ? ABSENT : value(match),
    );
  }
  return byTarget;
};

/** Constructs column matrix for all scenarios in report context. */
const matrix = (
  context: ReportContext,
  value: (summary: Summary) => string,
): Column[] =>
  context.scenarios.map((scenario) => ({
    byTarget: rowFor(context, scenario, value),
    scenario,
  }));

/** Renders an array of Column objects into markdown table lines. */
const table = (
  columns: readonly Column[],
  targets: readonly Target[],
): string[] => {
  const header = `| Scenario | ${targets.join(' | ')} |`;
  const divider = `| --- | ${targets.map(() => '---:').join(' | ')} |`;
  const rows = columns.map(
    (column) =>
      `| ${column.scenario} | ${targets
        .map((target) => column.byTarget.get(target) ?? ABSENT)
        .join(' | ')} |`,
  );
  return [header, divider, ...rows];
};

export { format, matrix, table };

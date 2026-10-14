import type { RunMeta, Target, Tool } from './env.types.ts';
import type { Sample, Summary } from './results.types.ts';

/** Minimal fields needed to reference a summary item. */
interface SummaryRef {
  /** Scenario identifier. */
  readonly scenario: string;
  /** Server implementation target. */
  readonly target: Target;
  /** Load generator tool used. */
  readonly tool: Tool;
}

/** Layout context needed to format tables in reports. */
interface ReportContext<Item extends SummaryRef = Summary> {
  /** Scenario identifiers included in report. */
  readonly scenarios: readonly string[];
  /** Summary records to display. */
  readonly summaries: readonly Item[];
  /** Targets evaluated. */
  readonly targets: readonly Target[];
}

/** Complete payload handed to report writer. */
interface ReportPayload {
  /** Hardware and runtime environment info. */
  readonly meta: RunMeta;
  /** Individual raw measurement samples. */
  readonly samples: readonly Sample[];
  /** Aggregated scenario summaries. */
  readonly summaries: readonly Summary[];
}

export type { ReportContext, ReportPayload, SummaryRef };

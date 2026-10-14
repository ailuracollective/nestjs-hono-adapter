/* eslint-disable unicorn/no-null -- replacer null required for json. */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ReportContext, ReportPayload } from '#benchmarks/harness/config/index';
import { toMarkdown } from './markdown.ts';

/** Spaces indentation count for output JSON files. */
const JSON_INDENT = 2;

/** Regular expression matching microsecond fractions in ISO date. */
const TRAILING_FRACTION = /\..+$/u;

/** File name of the committed Markdown metrics page. */
const REPORT_FILE = 'benchmarks.md';

/** Destinations for the two report artifacts. */
interface ReportTargets {
  /** Directory holding the committed Markdown metrics page. */
  readonly docs: string;
  /** Directory holding the raw JSON samples. */
  readonly results: string;
}

/**
 * Saves the raw samples as JSON under `results`, and the rendered metrics as a stable Markdown page
 * under `docs`.
 */
const report = async (
  payload: ReportPayload,
  context: ReportContext,
  targets: ReportTargets,
): Promise<void> => {
  const stamp = payload.meta.date.replaceAll(':', '-').replace(TRAILING_FRACTION, '');
  const markdown = toMarkdown(context, payload.meta);
  await mkdir(targets.results, { recursive: true });
  await mkdir(targets.docs, { recursive: true });
  await writeFile(
    path.join(targets.results, `results-${stamp}.json`),
    `${JSON.stringify(payload, null, JSON_INDENT)}\n`,
  );
  await writeFile(path.join(targets.docs, REPORT_FILE), markdown);
  process.stdout.write(`\n${markdown}`);
};

export type { ReportTargets };
export { report };

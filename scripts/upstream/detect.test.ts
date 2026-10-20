import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  compare,
  detect,
  isDetected,
  lastAvailable,
  main,
  majorOf,
  outputsOf,
  resolved,
  summaryOf,
} from './detect.ts';
import type { Registry } from './detect.ts';

interface Detection {
  name: string;
  range: string;
  from: string;
  last: string;
  isNew: boolean;
  accepted: boolean;
}

const detection = (isNew: boolean, accepted: boolean): Detection => ({
  name: '@nestjs/core',
  range: '^12.x',
  from: '12.1.3',
  last: '12.2.0',
  isNew,
  accepted,
});

/** A release the declared range does not take. */
const OUTSIDE: Detection = {
  name: 'hono',
  range: '^4.13.8',
  from: '4.13.13',
  last: '5.0.0',
  isNew: true,
  accepted: false,
};

/** The registry, answered without the network: the suite must not need the registry. */
const registry =
  (out: string, code = 0): Registry =>
  () => ({ out, code });

test('a release is ordered by its numbers', () => {
  expect(compare('12.2.0', '12.1.9')).toBeGreaterThan(0);
  expect(compare('12.1.3', '12.1.3')).toBe(0);
  expect(compare('4.13.13', '12.0.0')).toBeLessThan(0);
});

test('the major is the first number', () => {
  expect(majorOf('12.2.0')).toBe(12);
  expect(majorOf('4.13.13')).toBe(4);
});

test('the last available version is the one the registry tags as latest', () => {
  expect(lastAvailable('hono', registry('4.13.13'))).toBe('4.13.13');
  expect(() => lastAvailable('hono', registry('', 1))).toThrow(
    'The registry answered no version for hono.',
  );
});

test('the resolved version is the one the lockfile holds', async () => {
  expect(await resolved('hono')).toMatch(/^\d+\.\d+\.\d+$/);
  expect(await resolved('@nestjs/core')).toMatch(/^\d+\.\d+\.\d+$/);
  expect(resolved('not-a-package')).rejects.toThrow('The lockfile holds no not-a-package.');
});

test('a detection carries the release and what the range says of it', async () => {
  const found = await detect({ key: 'nest', name: '@nestjs/core' }, '^12.x', registry('12.99.0'));
  expect(found.name).toBe('@nestjs/core');
  expect(found.from).toMatch(/^\d+\.\d+\.\d+$/);
  expect(found.last).toBe('12.99.0');
  expect(found.isNew).toBe(true);
  expect(found.accepted).toBe(true);
});

test('a new release is detected only when the declared range takes it', () => {
  expect(isDetected([detection(true, true)])).toBe(true);
  expect(isDetected([detection(false, true)])).toBe(false);
  expect(isDetected([detection(true, false)])).toBe(false);
});

test('a release outside the declared range is not installed', () => {
  expect(outputsOf([OUTSIDE])).toContain('hono_to=4.13.13');
  expect(outputsOf([OUTSIDE], true)).toContain('hono_to=5.0.0');
});

test('the summary names the release, the range and what is outside it', () => {
  const summary = summaryOf([detection(true, true), OUTSIDE]);
  expect(summary).toContain('| `@nestjs/core` | `^12.x` | 12.1.3 | 12.2.0 | yes |');
  expect(summary).toContain('| `hono` | `^4.13.8` | 4.13.13 | 5.0.0 | no |');
  expect(summary).toContain('A new release is available: the suite runs against it.');
  expect(summary).toContain('### Outside the declared range');
  expect(summary).toContain(
    '- `hono` 5.0.0 is the last available version; the repository declares `^4.13.8`.',
  );
  expect(summaryOf([detection(false, true)])).toContain(
    'No new release is available: nothing to run.',
  );
});

test('the workflow declares every output the detection writes', async () => {
  // The outputs travel as text, so nothing in the types ties the script to the
  // workflow: a name that drifts is a watch that never runs.
  const detections = [
    {
      name: 'hono',
      range: '^4.13.8',
      from: '4.13.13',
      last: '4.13.13',
      isNew: false,
      accepted: true,
    },
    {
      name: '@nestjs/core',
      range: '^12.x',
      from: '12.1.3',
      last: '12.2.0',
      isNew: true,
      accepted: true,
    },
  ];
  const written = outputsOf(detections).map((line) => line.split('=')[0] ?? '');
  const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/upstream.yml').text()) as {
    jobs: { detect: { outputs: Record<string, string> } };
  };
  expect(Object.keys(workflow.jobs.detect.outputs).toSorted()).toEqual(written.toSorted());
});

test('the detection writes the outputs and the summary the workflow reads', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'upstream-detect-'));
  const output = path.join(dir, 'output');
  const summary = path.join(dir, 'summary');
  try {
    await main(registry('12.99.0'), { GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary });
    const written = await Bun.file(output).text();
    expect(written).toContain('detected=true');
    expect(written).toContain('nest_to=12.99.0');
    expect(await Bun.file(summary).text()).toContain('## Upstream releases');
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});

test('a run without the file to write is refused', () => {
  expect(main(registry('12.99.0'), { GITHUB_OUTPUT: '' })).rejects.toThrow(
    'The workflow did not set the file to write.',
  );
});

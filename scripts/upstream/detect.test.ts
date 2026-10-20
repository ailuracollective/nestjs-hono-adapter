import { expect, test } from 'bun:test';

import { compare, isDetected, lastAvailable, majorOf, outputsOf } from './detect.ts';

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

test('a release is ordered by its numbers', () => {
  expect(compare('12.2.0', '12.1.9')).toBeGreaterThan(0);
  expect(compare('12.1.3', '12.1.3')).toBe(0);
  expect(compare('4.13.13', '12.0.0')).toBeLessThan(0);
});

test('the major is the first number', () => {
  expect(majorOf('12.2.0')).toBe(12);
  expect(majorOf('4.13.13')).toBe(4);
});

test('the last available version is the one an install takes', () => {
  expect(lastAvailable('hono')).toMatch(/^\d+\.\d+\.\d+$/);
  expect(lastAvailable('@nestjs/core')).toMatch(/^\d+\.\d+\.\d+$/);
});

test('a new release is detected only when the declared range takes it', () => {
  expect(isDetected([detection(true, true)])).toBe(true);
  expect(isDetected([detection(false, true)])).toBe(false);
  expect(isDetected([detection(true, false)])).toBe(false);
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

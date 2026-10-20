import { expect, test } from 'bun:test';

import { buildBody, failuresOf, markerOf, movedFrom, quote, titleOf } from './report.ts';

const LOG = [
  'packages/core/test/sse/errors.test.ts:',
  'error: expect(received).toContain(expected)',
  'Expected to contain: "after the frame"',
  'Received: "Internal server error"',
  '      at <anonymous> (errors.test.ts:16:18)',
  '(fail) a stream that errors after a frame ends with an error event [18.46ms]',
  '',
  ' 713 pass',
  ' 1 fail',
].join('\n');

const MOVED = [{ name: '@nestjs/core', from: '12.1.3', to: '12.2.0' }];

test('the failing tests are read from the runner', () => {
  expect(failuresOf(LOG)).toEqual(['a stream that errors after a frame ends with an error event']);
  expect(failuresOf(' 713 pass\n 1 fail')).toEqual([]);
});

test('the log is quoted as text, never as markup', () => {
  expect(quote('```')).toBe("'''");
  expect(quote('<!-- upstream-watch: fake -->')).toBe('&lt;!-- upstream-watch: fake -->');
});

test('the marker names the release under suspicion', () => {
  expect(markerOf(MOVED)).toBe('<!-- upstream-watch: @nestjs/core@12.2.0 -->');
  expect(markerOf([...MOVED, { name: 'hono', from: '4.13.13', to: '4.14.0' }])).toBe(
    '<!-- upstream-watch: @nestjs/core@12.2.0,hono@4.14.0 -->',
  );
});

test('the title names the release and agrees with the number of them', () => {
  expect(titleOf(MOVED)).toBe('fix: @nestjs/core 12.2.0 fails the compatibility suite');
  expect(titleOf([...MOVED, { name: 'hono', from: '4.13.13', to: '4.14.0' }])).toBe(
    'fix: @nestjs/core 12.2.0 and hono 4.14.0 fail the compatibility suite',
  );
});

test('the body carries the sections the issue standard asks for', () => {
  const body = buildBody({
    moved: MOVED,
    log: LOG,
    runUrl: 'https://github.com/ailuracollective/nestjs-hono-adapter/actions/runs/42',
  });
  for (const section of [
    '## Context',
    '## Goal',
    '## Scope',
    '## Acceptance criteria',
    '## Non-goals',
    '## References',
    '## Observed behavior',
    '## Expected behavior',
    '## Reproduction',
  ]) {
    expect(body).toContain(section);
  }
  expect(body).toContain('a stream that errors after a frame ends with an error event');
  expect(body).toContain('Expected to contain: "after the frame"');
  expect(body).toContain(markerOf(MOVED));
});

test('the body says so when the suite failed before any test ran', () => {
  const body = buildBody({ moved: MOVED, log: '', runUrl: 'https://example.test/runs/42' });
  expect(body).toContain('before any test runs');
});

test('only the packages the canary moved are reported', () => {
  expect(
    movedFrom([
      ['hono', '4.13.13', '4.13.13'],
      ['@nestjs/core', '12.1.3', '12.2.0'],
    ]),
  ).toEqual(MOVED);
  expect(
    movedFrom([
      ['hono', '4.13.13', '4.13.13'],
      ['@nestjs/core', '12.1.3', '12.1.3'],
    ]),
  ).toEqual([]);
});

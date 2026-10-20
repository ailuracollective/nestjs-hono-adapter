import { rmSync } from 'node:fs';

import { expect, test } from 'bun:test';

import {
  buildBody,
  failuresOf,
  installedOf,
  main,
  markerOf,
  movedFrom,
  quote,
  reproductionOf,
  titleOf,
  watchedFrom,
  COMPATIBILITY_PACKAGES,
  ISSUE_FILE,
  ROOT_PACKAGES,
} from './report.ts';
import type { Gh, Issue } from './report.ts';

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

const WATCHED = [
  { name: 'hono', from: '4.13.13', to: '4.13.13' },
  { name: '@nestjs/core', from: '12.1.3', to: '12.2.0' },
];

const MOVED = [{ name: '@nestjs/core', from: '12.1.3', to: '12.2.0' }];

const ENVIRONMENT = {
  WATCH_HONO_FROM: '4.13.13',
  WATCH_HONO_TO: '4.13.13',
  WATCH_NEST_FROM: '12.1.3',
  WATCH_NEST_TO: '12.2.0',
  RUN_URL: 'https://github.com/ailuracollective/nestjs-hono-adapter/actions/runs/42',
};

/** The issue tracker, answered without the network: the suite must not open an issue. */
const tracker = (issues: Issue[] = []): { gh: Gh; calls: string[][] } => {
  const calls: string[][] = [];
  const gh: Gh = (args) => {
    calls.push(args);
    if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(issues);
    if (args[0] === 'label' && args[1] === 'list') return JSON.stringify([{ name: 'type/bug' }]);
    return '';
  };
  return { gh, calls };
};

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
  const body = buildBody({ watched: WATCHED, log: LOG, runUrl: ENVIRONMENT.RUN_URL });
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
  const body = buildBody({ watched: WATCHED, log: '', runUrl: 'https://example.test/runs/42' });
  expect(body).toContain('before any test runs');
});

test('only the packages the canary moved are reported', () => {
  expect(
    movedFrom(
      watchedFrom([
        ['hono', '4.13.13', '4.13.13'],
        ['@nestjs/core', '12.1.3', '12.2.0'],
      ]),
    ),
  ).toEqual(MOVED);
  expect(
    movedFrom(
      watchedFrom([
        ['hono', '4.13.13', '4.13.13'],
        ['@nestjs/core', '12.1.3', '12.1.3'],
      ]),
    ),
  ).toEqual([]);
});

test('a package the workflow did not name is refused', () => {
  expect(() => watchedFrom([['hono', '4.13.13', undefined]])).toThrow(
    'The workflow did not set the versions of hono.',
  );
});

test('the reproduction installs what the canary installed', () => {
  const reproduction = reproductionOf(WATCHED);
  expect(reproduction[0]).toBe(
    'bun add --exact hono@4.13.13 @nestjs/common@12.2.0 @nestjs/core@12.2.0 @nestjs/websockets@12.2.0 @nestjs/platform-ws@12.2.0 @nestjs/platform-socket.io@12.2.0',
  );
  expect(reproduction[1]).toBe(
    '(cd packages/compatibility && bun add --exact @nestjs/common@12.2.0 @nestjs/core@12.2.0 @nestjs/websockets@12.2.0 @nestjs/microservices@12.2.0 @nestjs/testing@12.2.0)',
  );
  expect(reproduction[2]).toBe('rm -rf node_modules packages/*/node_modules && bun install');
  expect(reproduction[3]).toBe('bun run typecheck && bun run test');
});

test('the canary installs the packages the reproduction installs', async () => {
  // The reproduction has to be the canary's own install: a mixed tree is what
  // the suite fails on.
  const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/upstream.yml').text()) as {
    jobs: { canary: { steps: { run?: string }[] } };
  };
  const step = workflow.jobs.canary.steps.find((entry) => (entry.run ?? '').includes('bun add'));
  const run = step === undefined ? '' : (step.run ?? '');
  const installed = [
    ...run.matchAll(
      /(?<package>@?[a-z0-9.-]+(?:\/[a-z0-9.-]+)?)@\$\{\{\s*needs\.detect\.outputs\.(?<target>\w+)\s*\}\}/g,
    ),
  ].map((match) => {
    const groups = match.groups ?? {};
    return `${groups.package}@${groups.target}`;
  });
  const expected = [...ROOT_PACKAGES, ...COMPATIBILITY_PACKAGES].map(
    ([name, follows]) => `${name}@${follows === 'hono' ? 'hono_to' : 'nest_to'}`,
  );
  expect(installed).toEqual(expected);
});

test('the report opens the issue for a release it has not reported yet', async () => {
  const { gh, calls } = tracker();
  try {
    await main(gh, ENVIRONMENT);
    const created = calls.find((args) => args[0] === 'issue' && args[1] === 'create') ?? [];
    expect(created.join(' ')).toContain('fix: @nestjs/core 12.2.0 fails the compatibility suite');
    expect(created.join(' ')).toContain('--label type/bug');
    expect(await Bun.file(ISSUE_FILE).text()).toContain('bun add --exact hono@4.13.13');
  } finally {
    rmSync(ISSUE_FILE, { force: true });
  }
});

test('a release that already carries an issue is not reported again', async () => {
  const { gh, calls } = tracker([{ number: 42, title: 'fix', body: markerOf(MOVED) }]);
  await main(gh, ENVIRONMENT);
  expect(calls.some((args) => args[1] === 'create')).toBe(false);
});

test('a run that moved nothing is refused', () => {
  const { gh } = tracker();
  expect(
    main(gh, {
      WATCH_HONO_FROM: '4.13.13',
      WATCH_HONO_TO: '4.13.13',
      WATCH_NEST_FROM: '12.1.3',
      WATCH_NEST_TO: '12.1.3',
      RUN_URL: ENVIRONMENT.RUN_URL,
    }),
  ).rejects.toThrow('No package was moved; there is nothing to report.');
});

test('the version the canary installed is the one the workflow set', () => {
  expect(installedOf(WATCHED, 'hono')).toBe('4.13.13');
  expect(installedOf(WATCHED, '@nestjs/core')).toBe('12.2.0');
  expect(() => installedOf(WATCHED, 'not-a-package')).toThrow(
    'The workflow did not set the versions of not-a-package.',
  );
});

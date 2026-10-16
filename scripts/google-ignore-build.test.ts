import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { expect, test } from 'bun:test';

import { checkPaths, getAffectedGoogleBuilds, googleBuildsAffected } from './ignore-build.ts';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function withRepo(run: (repo: string) => void): void {
  const repo = mkdtempSync(path.join(tmpdir(), 'google-ignore-build-'));
  try {
    git(repo, ['init', '-b', 'main']);
    git(repo, ['config', 'user.name', 'test']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(path.join(repo, 'watched.txt'), 'one\n');
    writeFileSync(path.join(repo, 'ignored.txt'), 'one\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'initial']);
    writeFileSync(path.join(repo, 'watched.txt'), 'two\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-m', 'change watched']);
    run(repo);
  } finally {
    rmSync(repo, { force: true, recursive: true });
  }
}

test('allows a build when no paths are provided', () => {
  const result = checkPaths({ base: 'HEAD', cwd: '/tmp', head: 'HEAD', paths: [] });
  expect(result.build).toBe(true);
});

test('builds when a watched path changed', () => {
  withRepo((repo) => {
    const result = checkPaths({
      base: 'HEAD^',
      cwd: repo,
      head: 'HEAD',
      paths: ['watched.txt'],
    });
    expect(result.build).toBe(true);
    expect(result.changed).toContain('watched.txt');
  });
});

test('skips when only an unwatched path changed', () => {
  withRepo((repo) => {
    const result = checkPaths({
      base: 'HEAD^',
      cwd: repo,
      head: 'HEAD',
      paths: ['ignored.txt'],
    });
    expect(result.build).toBe(false);
    expect(result.changed).toEqual([]);
  });
});

test('builds on an unresolvable base instead of skipping', () => {
  withRepo((repo) => {
    const result = checkPaths({
      base: 'definitely-not-a-ref',
      cwd: repo,
      head: 'HEAD',
      paths: ['watched.txt'],
    });
    expect(result.build).toBe(true);
  });
});

test('maps example-specific changes to one Google deployment', () => {
  expect(getAffectedGoogleBuilds(['packages/examples/google/fetch/src/index.ts'])).toEqual([
    'fetch',
  ]);
  expect(getAffectedGoogleBuilds(['packages/examples/google/node/src/server.ts'])).toEqual([
    'node',
  ]);
});

test('maps relevant core changes to both Google deployments', () => {
  expect(getAffectedGoogleBuilds(['packages/core/src/index.ts'])).toEqual(['fetch', 'node']);
  expect(getAffectedGoogleBuilds(['packages/core/package.json'])).toEqual(['fetch', 'node']);
});

test('ignores irrelevant core changes', () => {
  expect(getAffectedGoogleBuilds(['packages/core/test/foo.test.ts'])).toEqual([]);
  expect(getAffectedGoogleBuilds(['packages/core/README.md'])).toEqual([]);
});

test('maps root shared inputs to both Google deployments', () => {
  expect(getAffectedGoogleBuilds(['package.json'])).toEqual(['fetch', 'node']);
  expect(getAffectedGoogleBuilds(['bun.lock'])).toEqual(['fetch', 'node']);
});

test('ignores unrelated workspace packages and docs', () => {
  expect(getAffectedGoogleBuilds(['packages/benchmarks/README.md'])).toEqual([]);
  expect(getAffectedGoogleBuilds(['docs/architecture.md'])).toEqual([]);
});

test('mixes affected deployments', () => {
  expect(
    getAffectedGoogleBuilds([
      'packages/examples/google/fetch/src/index.ts',
      'packages/examples/google/node/Dockerfile',
    ]),
  ).toEqual(['fetch', 'node']);
});

test('fails safe for unclassified paths', () => {
  expect(getAffectedGoogleBuilds(['some/random/file.txt'])).toEqual(['fetch', 'node']);
  expect(getAffectedGoogleBuilds([])).toEqual(['fetch', 'node']);
});

test('googleBuildsAffected returns booleans', () => {
  expect(googleBuildsAffected(['packages/examples/google/fetch/src/index.ts'])).toEqual({
    fetch: true,
    node: false,
  });
});

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/** Where the package source lives, so the scan reads `src/`. */
const SOURCE_ROOT = path.resolve(import.meta.dirname, '../src');

/**
 * Every `node:` builtin the source is allowed to name.
 *
 * This is a freeze, not a wish list. The adapter serves through
 * Bun's own server and the platform is Bun; the builtins below
 * are the ones Nest, Bun and the features this package carries
 * still rely on. When this test fails, one of two things is
 * true, and the choice is yours to make deliberately: the new
 * import is wrong and the source goes back, or this list is
 * updated on purpose, in the same change.
 *
 * A type-only import counts here too. It costs nothing at
 * runtime, but it still couples that module's types to the
 * platform, which is what this list records.
 */
const FROZEN_NODE_BUILTINS = [
  'node:buffer',
  'node:events',
  'node:fs/promises',
  'node:http',
  'node:https',
  'node:path',
  'node:stream',
  'node:util',
];

/**
 * One `import ... from '...'` statement, and the side-effect
 * import beside it. Whether an import is type-only or not is
 * not the question here, so both are read the same way.
 */
const IMPORT = /import\s+[^;]*?from\s*'(?<module>[^']+)'/gu;

/** A side-effect import, which the pattern above cannot match. */
const BARE_IMPORT = /import\s+'(?<module>[^']+)'/gu;

/**
 * The named group a match captured, or `''` when it captured
 * none.
 */
function groupOf(
  match: RegExpMatchArray,
  name: string,
): string {
  const groups: Record<string, string> = match.groups ?? {};
  return groups[name] ?? '';
}

/** Every source file under `src/`, relative to it and sorted. */
async function sourceFiles(): Promise<string[]> {
  const found = await readdir(SOURCE_ROOT, { recursive: true });
  return found
    .filter((name) => name.endsWith('.ts'))
    .toSorted();
}

/**
 * The Node builtins one source file imports, type-only
 * included.
 */
async function builtinsIn(file: string): Promise<string[]> {
  const source = await readFile(
    path.join(SOURCE_ROOT, file),
    'utf8',
  );
  const named = [...source.matchAll(IMPORT)];
  const bare = [...source.matchAll(BARE_IMPORT)];
  const specifiers = [...named, ...bare].map((match) =>
    groupOf(match, 'module'),
  );
  return specifiers.filter((specifier) =>
    specifier.startsWith('node:'),
  );
}

/**
 * Every Node builtin imported anywhere under `src/`,
 * deduplicated.
 */
async function nodeBuiltins(): Promise<string[]> {
  const files = await sourceFiles();
  const perFile = await Promise.all(
    files.map((file) => builtinsIn(file)),
  );
  return [...new Set(perFile.flat())].toSorted();
}

test('the source imports no Node builtin beyond the frozen list', async () => {
  const imported = await nodeBuiltins();
  expect(imported.length).toBeGreaterThan(0);
  expect(imported).toStrictEqual(
    [...FROZEN_NODE_BUILTINS].toSorted(),
  );
});

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/** Where the package source lives. */
const SOURCE_ROOT = path.resolve(
  import.meta.dirname,
  '../packages/core/src',
);

/** Every `node:` builtin the source is allowed to name. */
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

/** One `import ... from '...'` statement. */
const IMPORT = /import\s+[^;]*?from\s*'(?<module>[^']+)'/gu;

/** A side-effect import, which the pattern above cannot match. */
const BARE_IMPORT = /import\s+'(?<module>[^']+)'/gu;

/** The named group a match captured, or `''`. */
const groupOf = (
  match: RegExpMatchArray,
  name: string,
): string => {
  const groups: Record<string, string> = match.groups ?? {};
  return groups[name] ?? '';
};

/** Every source file under the source root, sorted. */
const sourceFiles = async (): Promise<string[]> => {
  const found = await readdir(SOURCE_ROOT, { recursive: true });
  return found
    .filter((name) => name.endsWith('.ts'))
    .toSorted();
};

/** The Node builtins one source file imports. */
const builtinsIn = async (file: string): Promise<string[]> => {
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
};

/** Every Node builtin imported anywhere under the source root. */
const nodeBuiltins = async (): Promise<string[]> => {
  const files = await sourceFiles();
  const perFile = await Promise.all(
    files.map((file) => builtinsIn(file)),
  );
  return [...new Set(perFile.flat())].toSorted();
};

test('the source imports no Node builtin beyond the frozen list', async () => {
  const imported = await nodeBuiltins();
  expect(imported.length).toBeGreaterThan(0);
  expect(imported).toStrictEqual(
    [...FROZEN_NODE_BUILTINS].toSorted(),
  );
});

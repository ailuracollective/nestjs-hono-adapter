import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

const REPOSITORY = path.resolve(import.meta.dirname, '..');

const SOURCE_ROOT = path.resolve(import.meta.dirname, '../packages/core/src');

/**
 * The trees that hold a compatibility bridge: the region inside the adapter, and the packages that
 * carry one for a platform still outside it.
 */
const BRIDGE_ROOTS = [
  path.join(SOURCE_ROOT, 'compat'),
  path.resolve(import.meta.dirname, '../packages/graphql/src'),
  path.resolve(import.meta.dirname, '../packages/serve-static/src'),
  path.resolve(import.meta.dirname, '../packages/ws/src'),
];

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

const IMPORT = /import\s+[^;]*?from\s*'(?<module>[^']+)'/gu;

const BARE_IMPORT = /import\s+'(?<module>[^']+)'/gu;

const groupOf = (match: RegExpMatchArray, name: string): string => {
  const groups: Record<string, string> = match.groups ?? {};
  return groups[name] ?? '';
};

const sourceFiles = async (root: string): Promise<string[]> => {
  const found = await readdir(root, { recursive: true });
  return found
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(root, name))
    .toSorted();
};

const builtinsIn = async (file: string): Promise<string[]> => {
  const source = await readFile(file, 'utf8');
  const named = [...source.matchAll(IMPORT)];
  const bare = [...source.matchAll(BARE_IMPORT)];
  const specifiers = [...named, ...bare].map((match) => groupOf(match, 'module'));
  return specifiers.filter((specifier) => specifier.startsWith('node:'));
};

const filesPerBridgeRoot = (): Promise<string[]>[] => BRIDGE_ROOTS.map((root) => sourceFiles(root));

const bridgeFiles = async (): Promise<string[]> => {
  const perRoot = await Promise.all(filesPerBridgeRoot());
  return perRoot.flat();
};

const cited = async (file: string): Promise<{ builtins: string[]; name: string }> => ({
  builtins: await builtinsIn(file),
  name: path.relative(REPOSITORY, file),
});

const nodeBuiltins = async (): Promise<string[]> => {
  const files = await sourceFiles(SOURCE_ROOT);
  const perFile = await Promise.all(files.map((file) => builtinsIn(file)));
  return [...new Set(perFile.flat())].toSorted();
};

test('the source imports no Node builtin beyond the frozen list', async () => {
  const imported = await nodeBuiltins();
  expect(imported.length).toBeGreaterThan(0);
  expect(imported).toStrictEqual([...FROZEN_NODE_BUILTINS].toSorted());
});

test('the guard walks every bridge tree, not only the one in the adapter', async () => {
  const perRoot = await Promise.all(filesPerBridgeRoot());
  expect(perRoot.every((files) => files.length > 0)).toBe(true);
});

test('a compatibility bridge names no runtime', async () => {
  const bridges = await bridgeFiles();
  expect(bridges.length).toBeGreaterThan(0);
  const perFile = await Promise.all(bridges.map((file) => builtinsIn(file)));
  expect(perFile.flat()).toStrictEqual([]);
});

test('a compatibility bridge reads files through the transport, not a filesystem API', async () => {
  const perRoot = await Promise.all(filesPerBridgeRoot());
  const citedPerRoot = await Promise.all(perRoot.flat().map((file) => cited(file)));
  const filesystem = citedPerRoot.filter(
    (file) => file.builtins.includes('node:fs') || file.builtins.includes('node:fs/promises'),
  );
  expect(filesystem.map((file) => file.name)).toStrictEqual([]);
});

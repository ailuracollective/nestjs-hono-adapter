import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/** The HTTP entry point, and the WebSocket one beside it. */
const ENTRY = path.resolve(import.meta.dir, '../src/index.ts');
const WS_ENTRY = path.resolve(import.meta.dir, '../src/ws.ts');

/**
 * The packages a deployment that only serves HTTP must not
 * need. `ws` is named too, because it is only reachable through
 * `@hono/node-ws`.
 */
const OPTIONAL_PEERS = [
  '@hono/node-ws',
  '@nestjs/websockets',
  'ws',
];

/** The modules a source file names in its import statements. */
const SPECIFIER = /from\s+'(?<module>[^']+)'/gu;

/** The module a match named, when the pattern captured one. */
function moduleOf(
  groups: Record<string, string> | undefined,
): string | undefined {
  if (groups === undefined) {
    return undefined;
  }
  return groups.module;
}

function specifiersIn(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const module = moduleOf(match.groups);
    if (module !== undefined) {
      names.push(module);
    }
  }
  return names;
}

/** Says whether a module name is, or belongs to, a peer. */
function isPeer(name: string): boolean {
  return OPTIONAL_PEERS.some(
    (peer) => name === peer || name.startsWith(`${peer}/`),
  );
}

/** Says whether one file names an optional peer. */
async function namesPeer(file: string): Promise<boolean> {
  const source = await readFile(file, 'utf8');
  return specifiersIn(source).some((name) => isPeer(name));
}

/**
 * Follows the relative imports of one file, so the check reads
 * everything Node would load rather than one file.
 */
async function visit(
  file: string,
  seen: Set<string>,
): Promise<void> {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);
  const source = await readFile(file, 'utf8');
  const next = specifiersIn(source).filter((name) =>
    name.startsWith('.'),
  );
  await Promise.all(
    next.map((name) =>
      visit(path.resolve(path.dirname(file), name), seen),
    ),
  );
}

/** Every source file an entry point reaches, itself included. */
async function reachable(entry: string): Promise<string[]> {
  const seen = new Set<string>();
  await visit(entry, seen);
  return [...seen];
}

/** The reached files that name an optional peer. */
async function peersReachedBy(
  entry: string,
): Promise<string[]> {
  const files = await reachable(entry);
  const checks = await Promise.all(
    files.map((file) => namesPeer(file)),
  );
  return files.filter((_file, index) => checks[index] === true);
}

test('the HTTP entry point reaches no optional peer', async () => {
  const files = await reachable(ENTRY);
  expect(files.length).toBeGreaterThan(1);
  const offenders = await peersReachedBy(ENTRY);
  expect(offenders).toStrictEqual([]);
});

test('the WebSocket entry point does reach the optional peers', async () => {
  const peerFiles = await peersReachedBy(WS_ENTRY);
  const names = peerFiles.map((file) => path.basename(file));
  expect(names).toContain('ws-adapter.ts');
});

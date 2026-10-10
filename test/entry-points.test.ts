import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/** The HTTP entry point, and the WebSocket one beside it. */
const ENTRY = path.resolve(
  import.meta.dirname,
  '../src/index.ts',
);
const WS_ENTRY = path.resolve(
  import.meta.dirname,
  '../src/ws/index.ts',
);

/**
 * The packages only a deployment that serves websockets needs.
 * The island is the one place that names them, so an
 * application that opens no gateway never installs them.
 */
const ISLAND_PEERS = ['@hono/node-ws', '@nestjs/websockets'];

/**
 * The server the adapter builds when a deployment names no
 * transport. It is reached — and required — on purpose: the
 * HTTP entry point serves through it by default, which is the
 * runtime this package has always served through.
 */
const DEFAULT_SERVER = '@hono/node-server';

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

/** Says whether a module name is, or belongs to, a package. */
function belongsTo(name: string, packageName: string): boolean {
  return (
    name === packageName || name.startsWith(`${packageName}/`)
  );
}

/** Says whether one file names a package. */
async function namesPackage(
  file: string,
  packageName: string,
): Promise<boolean> {
  const source = await readFile(file, 'utf8');
  return specifiersIn(source).some((name) =>
    belongsTo(name, packageName),
  );
}

/** Says whether one file names a package only the island may. */
async function namesIslandPeer(file: string): Promise<boolean> {
  const source = await readFile(file, 'utf8');
  return specifiersIn(source).some((name) =>
    ISLAND_PEERS.some((peer) => belongsTo(name, peer)),
  );
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

/** The reached files that name a package. */
async function carriersOf(
  entry: string,
  packageName: string,
): Promise<string[]> {
  const files = await reachable(entry);
  const checks = await Promise.all(
    files.map((file) => namesPackage(file, packageName)),
  );
  return files.filter((_file, index) => checks[index] === true);
}

/** The reached files that name a package only the island may. */
async function peersReachedBy(
  entry: string,
): Promise<string[]> {
  const files = await reachable(entry);
  const checks = await Promise.all(
    files.map((file) => namesIslandPeer(file)),
  );
  return files.filter((_file, index) => checks[index] === true);
}

test('the HTTP entry point reaches no websocket peer', async () => {
  const files = await reachable(ENTRY);
  expect(files.length).toBeGreaterThan(1);
  expect(await peersReachedBy(ENTRY)).toStrictEqual([]);
});

test('the HTTP entry point reaches the server it serves by default', async () => {
  const carriers = await carriersOf(ENTRY, DEFAULT_SERVER);
  expect(carriers.length).toBeGreaterThan(0);
  const names = carriers.map((file) => path.basename(file));
  expect(names).toContain('node.ts');
});

test('the WebSocket entry point does reach the island peers', async () => {
  const peerFiles = await peersReachedBy(WS_ENTRY);
  const names = peerFiles.map((file) => path.basename(file));
  expect(names).toContain('adapter.ts');
});

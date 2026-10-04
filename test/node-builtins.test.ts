import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'vitest';

/**
 * A package written in TypeScript and published as JavaScript
 * still leans on Node internals, and this one leans on eight of
 * them. That is the surface a consumer receives, so the record
 * below is the contract. `src/` is frozen; `test/` is free,
 * because nothing that runs here reaches an install.
 *
 * Both directions are exact. A builtin that appears is a change
 * somebody has to own, so it waits for the edit that records
 * it; a builtin that disappears waits for the edit that deletes
 * it. Containment would let either half rot on its own, and a
 * record that drifts describes a package that is no longer
 * there.
 *
 * A ninth builtin is only safe if the runtime still resolves
 * it, which is what the Workers flag asserted below is for. It
 * sits beside the record rather than in a test of its own
 * because the two make one claim: this adapter is not runtime
 * neutral, and the flag is how it says so out loud.
 */

/** The builtins a consumer resolves when they install this. */
const FROZEN = [
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
 * The flag Cloudflare needs before those builtins resolve at
 * all.
 */
const WORKER_FLAG = 'enable_nodejs_http_server_modules';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'src');
const WRANGLER = path.join(
  ROOT,
  'examples/cloudflare-workers/wrangler.jsonc',
);

/**
 * The modules a walk of `src/` has to find. A walk that read
 * half the tree would report a set that looks right and is not,
 * so the walk refuses to report one until it has seen all of
 * them: a tree missing one has been renamed, not proven.
 */
const REQUIRED = [
  'src/core/body.ts',
  'src/core/bridge.ts',
  'src/core/closing.ts',
  'src/core/context.ts',
  'src/core/directories.ts',
  'src/core/handler-bridge.ts',
  'src/core/hono-lifecycle.ts',
  'src/core/path.ts',
  'src/core/query.ts',
  'src/core/response-helpers.ts',
  'src/core/response-writer.ts',
  'src/core/route-adapter.ts',
  'src/core/server-adapter.ts',
  'src/core/version-filter.ts',
  'src/core/versioned-route.ts',
  'src/features/cors-middleware.ts',
  'src/features/sse.ts',
  'src/features/static-assets.ts',
  'src/features/views.ts',
  'src/index.ts',
  'src/ws-adapter.ts',
  'src/ws-client.ts',
  'src/ws-server.ts',
  'src/ws.ts',
];

/** Why a builtin the record does not name is refused. */
const UNRECORDED =
  'a builtin outside the record is a change somebody has to own: add it here in the same change, and prove the runtime still resolves it';

/** Why an entry nothing imports any more is refused. */
const UNUSED =
  'the record names a builtin no source file imports, so it describes a package that no longer exists: delete the entry in the same change';

/** One `node:` name, and the file that named it. */
interface Import {
  readonly builtin: string;
  readonly file: string;
}

/**
 * Every quoted `node:` name in a file, read as a whole string
 * and never as a prefix of another: `node:fs` and
 * `node:fs/promises` are two dependencies, not one name and a
 * longer one. A deferred builtin counts too, because a consumer
 * resolves it just the same.
 */
const SPECIFIER =
  /(?<quote>["'])(?<builtin>node:[^"']+)\k<quote>/gu;

/** The modules the workers configuration is read through. */
const COMPATIBILITY =
  /"compatibility_flags"\s*:\s*\[(?<body>[^\]]*)\]/u;

/** The named capture of a match, when the match has one. */
function captured(
  groups: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (groups === undefined) {
    return undefined;
  }
  return groups[name];
}

/** The body of the flags block, and none when there is no block. */
function flagsBlock(source: string): string {
  const match = COMPATIBILITY.exec(source);
  if (match === null) {
    return '';
  }
  const body = captured(match.groups, 'body');
  if (body === undefined) {
    return '';
  }
  return body;
}

/** Every `.ts` file under a directory, nested ones included. */
async function sourceFiles(
  directory: string,
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        sourceFiles(path.join(directory, entry.name)),
      ),
  );
  const here = entries
    .filter(
      (entry) =>
        !entry.isDirectory() && entry.name.endsWith('.ts'),
    )
    .map((entry) => path.join(directory, entry.name));
  return [...nested.flat(), ...here];
}

/** The repository-relative modules of a tree, or a refusal. */
async function readTree(root: string): Promise<string[]> {
  try {
    const files = await sourceFiles(root);
    return files.map((file) => path.relative(ROOT, file));
  } catch (error) {
    throw new Error(
      `the walk of ${root} read nothing: ${String(error)}`,
      { cause: error },
    );
  }
}

/**
 * The builtin names one file writes, in the order it writes
 * them.
 */
function builtinsIn(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const builtin = captured(match.groups, 'builtin');
    if (builtin !== undefined) {
      names.push(builtin);
    }
  }
  return names;
}

/** What one module asks a consumer to resolve. */
async function importsIn(file: string): Promise<Import[]> {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  return builtinsIn(source).map((builtin) => ({
    builtin,
    file,
  }));
}

/**
 * Every `node:` name of a tree, each with the file that named
 * it.
 */
async function scan(root: string): Promise<Import[]> {
  const files = await readTree(root);
  const missing = REQUIRED.filter(
    (name) => !files.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `the walk of ${root} found no ${missing.join(', ')}`,
    );
  }
  const found = await Promise.all(
    files.map((file) => importsIn(file)),
  );
  return found.flat();
}

/** The builtins a scan found that the record does not name. */
function unrecorded(found: readonly Import[]): Import[] {
  return found.filter(
    ({ builtin }) => !FROZEN.includes(builtin),
  );
}

/** The entries of the record that no source file named. */
function unused(found: readonly Import[]): string[] {
  const named = new Set(found.map(({ builtin }) => builtin));
  return FROZEN.filter((builtin) => !named.has(builtin));
}

/** How a failure reads it: the builtin, then the file. */
function describes({ builtin, file }: Import): string {
  return `${builtin} in ${file}`;
}

/**
 * The compatibility flags the workers example asks wrangler
 * for.
 */
function flagsOf(source: string): string[] {
  const flags: string[] = [];
  for (const match of flagsBlock(source).matchAll(
    /["'](?<flag>[^"']+)["']/gu,
  )) {
    const flag = captured(match.groups, 'flag');
    if (flag !== undefined) {
      flags.push(flag);
    }
  }
  return flags;
}

test('src/ imports only the builtins the record names', async () => {
  const added = unrecorded(await scan(SOURCE)).map((entry) =>
    describes(entry),
  );
  expect(added, UNRECORDED).toStrictEqual([]);
});

test('the record names only what src/ imports', async () => {
  expect(unused(await scan(SOURCE)), UNUSED).toStrictEqual([]);
});

test('a specifier is a whole name, not a prefix of another', () => {
  const source = [
    "import fs from 'node:fs';",
    "import { readFile } from 'node:fs/promises';",
  ].join('\n');
  expect(builtinsIn(source)).toStrictEqual([
    'node:fs',
    'node:fs/promises',
  ]);
});

test('a deferred builtin is still a dependency', () => {
  const source = "const os = await import('node:os');";
  expect(builtinsIn(source)).toStrictEqual(['node:os']);
});

test('the workers example asks for the flag that resolves them', async () => {
  const config = await readFile(WRANGLER, 'utf8');
  expect(
    flagsOf(config),
    'the builtins above resolve under workers only while this flag is set, so a new one has to arrive with proof the flag still covers it',
  ).toContain(WORKER_FLAG);
});

test('only the flags block is read, not a mention of the flag', () => {
  const config = [
    '{',
    `  // ${WORKER_FLAG} is spelled out in prose too`,
    '  "compatibility_flags": ["nodejs_compat"]',
    '}',
  ].join('\n');
  expect(flagsOf(config)).toStrictEqual(['nodejs_compat']);
});

test('a tree that is not there is refused, not read as empty', async () => {
  await expect(
    scan(path.join(ROOT, 'src/no-such-tree')),
  ).rejects.toThrow(/read nothing/u);
});

test('a tree missing a module is refused too', async () => {
  await expect(scan(path.join(ROOT, 'test'))).rejects.toThrow(
    /found no src\/core\/body\.ts/u,
  );
});

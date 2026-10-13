import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

import coreManifest from '../packages/core/package.json' with { type: 'json' };
import multipartManifest from '../packages/multipart/package.json' with { type: 'json' };
import socketIoManifest from '../packages/socket-io/package.json' with { type: 'json' };
import wsManifest from '../packages/ws/package.json' with { type: 'json' };

/** One published package, and the directory its source lives in. */
interface PublishedPackage {
  readonly dir: string;
  readonly name: string;
  readonly exports: Record<
    string,
    { readonly default: string }
  >;
}

/**
 * Everything the repository publishes: the adapter core, which
 * carries the four adapter entry points, and the three
 * capability packages, each with the single entry point of its
 * own.
 */
const PACKAGES: readonly PublishedPackage[] = [
  {
    dir: 'packages/core',
    exports: coreManifest.exports,
    name: coreManifest.name,
  },
  {
    dir: 'packages/multipart',
    exports: multipartManifest.exports,
    name: multipartManifest.name,
  },
  {
    dir: 'packages/socket-io',
    exports: socketIoManifest.exports,
    name: socketIoManifest.name,
  },
  {
    dir: 'packages/ws',
    exports: wsManifest.exports,
    name: wsManifest.name,
  },
];

/** The HTTP entry point, and the WebSocket one beside it. */
const ENTRY = path.resolve(
  import.meta.dirname,
  '../packages/core/src/index.ts',
);
const WS_ENTRY = path.resolve(
  import.meta.dirname,
  '../packages/ws/src/index.ts',
);
const MULTIPART_ENTRY = path.resolve(
  import.meta.dirname,
  '../packages/multipart/src/index.ts',
);
const SOCKET_IO_ENTRY = path.resolve(
  import.meta.dirname,
  '../packages/socket-io/src/index.ts',
);

/**
 * The parser the upload island alone may reach. It is an
 * optional peer: a deployment that serves no upload never
 * installs it.
 */
const UPLOAD_PARSER = 'busboy';

/**
 * The packages only a deployment that serves websockets needs.
 * The island is the one place that names them, so an
 * application that opens no gateway never installs them.
 */
const ISLAND_PEERS = ['@hono/node-ws', '@nestjs/websockets'];

/**
 * The protocol the socket.io island alone may reach. It is an
 * optional peer too: a deployment that runs no socket.io
 * gateway never installs it, and no other entrypoint names it.
 */
const SOCKET_IO_PEER = 'socket.io';

/**
 * The server the adapter builds when a deployment names no
 * transport. It is reached — and required — on purpose: the
 * HTTP entry point serves through it by default, which is the
 * runtime this package has always served through.
 */
const DEFAULT_SERVER = '@hono/node-server';

/** The name the adapter core publishes under. */
const CORE_NAME = '@ailura/nestjs-hono-adapter';

/** The prefix the three capability packages share. */
const PLATFORM_PREFIX = '@ailura/nestjs-platform-hono-';

/** The three capability packages, under their published names. */
const PLATFORM_NAMES = [
  `${PLATFORM_PREFIX}multipart`,
  `${PLATFORM_PREFIX}socket-io`,
  `${PLATFORM_PREFIX}ws`,
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

/** The name an entry point is published under, e.g. `pkg/sub`. */
function entryPointName(
  pkgName: string,
  subpath: string,
): string {
  if (subpath === '.') {
    return pkgName;
  }
  return `${pkgName}${subpath.slice(1)}`;
}

/** The source file a package's export target resolves to. */
function sourceOf(dir: string, target: string): string {
  const relative = target
    .replace(/^\.\/dist\//u, '')
    .replace(/\.js$/u, '.ts');
  return path.resolve(
    import.meta.dirname,
    '..',
    dir,
    'src',
    relative,
  );
}

/**
 * Every published entry point but socket.io's, which is the one
 * allowed to reach the socket.io peer.
 */
const OTHER_ENTRY_POINTS = PACKAGES.filter(
  (pkg) => pkg.name !== `${PLATFORM_PREFIX}socket-io`,
).flatMap((pkg) =>
  Object.entries(pkg.exports).map(
    ([subpath, target]) =>
      [
        entryPointName(pkg.name, subpath),
        sourceOf(pkg.dir, target.default),
      ] as const,
  ),
);

test('the adapter publishes its four entry points', () => {
  expect(coreManifest.name).toBe(CORE_NAME);
  expect(
    Object.keys(coreManifest.exports).toSorted(),
  ).toStrictEqual([
    '.',
    './bun-server',
    './fetch',
    './node-server',
  ]);
});

test('each platform package publishes one entry point', () => {
  const capabilities = PACKAGES.filter(
    (pkg) => pkg.dir !== 'packages/core',
  );
  expect(
    capabilities.map((pkg) => pkg.name).toSorted(),
  ).toStrictEqual(PLATFORM_NAMES);
  for (const pkg of capabilities) {
    expect(Object.keys(pkg.exports)).toStrictEqual(['.']);
  }
});

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

test.each(OTHER_ENTRY_POINTS)(
  '%s reaches no socket.io peer',
  async (_name, source) => {
    expect(
      await carriersOf(source, SOCKET_IO_PEER),
    ).toStrictEqual([]);
  },
);

test('the socket.io entry point does reach socket.io', async () => {
  const carriers = await carriersOf(
    SOCKET_IO_ENTRY,
    SOCKET_IO_PEER,
  );
  const names = carriers.map((file) => path.basename(file));
  expect(names).toContain('adapter.ts');
});

test('the HTTP entry point reaches no upload parser', async () => {
  expect(await carriersOf(ENTRY, UPLOAD_PARSER)).toStrictEqual(
    [],
  );
});

test('the multipart entry point does reach the upload parser', async () => {
  const carriers = await carriersOf(
    MULTIPART_ENTRY,
    UPLOAD_PARSER,
  );
  expect(carriers.length).toBeGreaterThan(0);
});

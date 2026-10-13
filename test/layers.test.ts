import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/**
 * The rules that keep `src/` layered, read off the source graph
 * rather than off a file list: `core/` holds the Nest to Hono
 * contract, `features/` the optional capabilities, and the two
 * islands — the `ws-*` one behind `/ws` and `multipart/` behind
 * `/multipart` — are worlds of their own.
 *
 * Every rule already holds, so the scan has nothing to observe
 * today. What keeps this file alive is the synthetic crossings
 * below and the proof that the walk really read the tree: a
 * guard handed no `core/` and no `features/` would pass while
 * checking nothing at all.
 */

/** One relative import, and whether it is a type. */
interface Edge {
  readonly from: string;
  readonly to: string;
  readonly typeOnly: boolean;
}

/** The layers of the tree, and the root is not one of them. */
type Layer =
  | 'core'
  | 'features'
  | 'multipart'
  | 'socket-io'
  | 'ws';

const ROOT = path.resolve(import.meta.dir, '..');
const SOURCE = path.join(ROOT, 'src');

/**
 * The two core modules that may name a feature, because they
 * are the composition roots: the one that mounts CORS, and the
 * one that binds the optional capabilities to the adapter. A
 * third core module naming a feature would be a layer that
 * cannot be reasoned about alone.
 */
const COMPOSITION_ROOTS = new Set([
  'src/core/hono-lifecycle.ts',
  'src/core/server-adapter.ts',
]);

/**
 * The modules a walk of `src/` has to find. A tree that is
 * missing one has been renamed, not proven: the scan refuses it
 * instead of reading the absence as an absence of crossings.
 */
const REQUIRED = [
  ...COMPOSITION_ROOTS,
  'src/core/multipart.ts',
  'src/features/cors-middleware.ts',
  'src/features/sse.ts',
  'src/features/static-assets.ts',
  'src/features/views.ts',
  'src/socket-io/index.ts',
];

/**
 * The modules a source file names, and whether the statement
 * that named one is a type. This is the criterion of
 * `entry-points.test.ts`, widened with the `type` keyword and
 * nothing else: rules one to three count a type import as an
 * edge like any other, so that a type which later becomes a
 * value is still caught, and only rule four needs the two told
 * apart.
 */
const SPECIFIER =
  /^[ \t]*(?:import|export)[ \t]+(?<typeOnly>type\b[ \t]*)?[^;]*?\bfrom\s+'(?<module>[^']+)'/gmu;

/** The relative module a match named, and none for a package. */
function relativeOf(
  groups: Record<string, string> | undefined,
): string | undefined {
  if (groups === undefined) {
    return undefined;
  }
  const { module = '' } = groups;
  if (!module.startsWith('.')) {
    return undefined;
  }
  return module;
}

/** Says whether the statement that named the module is a type. */
function typeOnlyOf(
  groups: Record<string, string> | undefined,
): boolean {
  if (groups === undefined) {
    return false;
  }
  return groups.typeOnly !== undefined;
}

/** A crossing as a module would draw it, type-only when asked. */
function crossing(
  from: string,
  to: string,
  typeOnly = false,
): Edge {
  return { from, to, typeOnly };
}

/** The directory each island is rooted at, and its layer. */
const ISLANDS: Readonly<Record<string, Layer>> = {
  'packages/multipart/src': 'multipart',
  'packages/ws/src': 'ws',

  'src/features': 'features',
  'src/socket-io': 'socket-io',
};

/** The layer a source path belongs to, and none for the roots. */
function layerOf(file: string): Layer | undefined {
  const directory = path.dirname(file);
  if (directory === 'src/core') {
    return 'core';
  }
  if (directory.startsWith('packages/multipart/src/')) {
    return 'multipart';
  }
  if (
    directory.startsWith('src/socket-io/') ||
    directory.startsWith(
      path.join('packages', 'socket-io', 'src'),
    )
  ) {
    return 'socket-io';
  }
  return ISLANDS[directory];
}

/** The edges a core module takes into a feature. */
function coreReachesFeature(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'core' &&
      layerOf(edge.to) === 'features' &&
      !COMPOSITION_ROOTS.has(edge.from),
  );
}

/** The edges a feature takes into another feature. */
function featureReachesFeature(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'features' &&
      layerOf(edge.to) === 'features',
  );
}

/** The edges a feature takes into the ws island. */
function featureReachesWs(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'features' &&
      layerOf(edge.to) === 'ws',
  );
}

/**
 * The edges the ws island takes into the HTTP application. A
 * type is not one of them: the compiler erases it, so the
 * runtime graph of `/ws` is four modules and never reaches the
 * application an adapter would otherwise pull in.
 */
function wsReachesApp(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features') &&
      !edge.typeOnly,
  );
}

/**
 * The one value edge the upload island is allowed into the
 * application: the marker `declareMultipart`, which tells the
 * adapter an interceptor owns a multipart body. Every other
 * import the island makes into `core/` or `features/` has to be
 * a type, so the compiler erases it and the island's runtime
 * graph stays inside `src/multipart/` — the argument rule 4
 * makes for `/ws`, with the one exception the marker needs.
 */
const MULTIPART_VALUE_EDGE = 'src/core/multipart.ts';

/**
 * The edges the upload island takes into the application as
 * values, minus the one marker it is allowed to set.
 */
function multipartReachesApp(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'multipart' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features') &&
      !edge.typeOnly &&
      edge.to !== MULTIPART_VALUE_EDGE,
  );
}

/**
 * The edges the socket.io island takes into the application. It
 * takes none, at runtime or as a type: Nest hands the adapter
 * the server it already built, so the island's runtime graph is
 * `socket.io` and the three modules behind `./socket-io`, and
 * naming anything in `core/` or `features/` would mean it had
 * grown a dependency on the application it is meant to be
 * usable without.
 */
function socketIoReachesApp(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'socket-io' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features'),
  );
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

/** The relative imports of one file, resolved against it. */
async function edgesFrom(file: string): Promise<Edge[]> {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  const found: Edge[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const module = relativeOf(match.groups);
    if (module !== undefined) {
      found.push({
        from: file,
        to: path.join(path.dirname(file), module),
        typeOnly: typeOnlyOf(match.groups),
      });
    }
  }
  return found;
}

/** The repository-relative source files of a tree, or a failure. */
async function readTree(root: string): Promise<string[]> {
  try {
    const files = await sourceFiles(root);
    return files.map((file) => path.relative(ROOT, file));
  } catch (error) {
    throw new Error(
      `the walk of ${root} read nothing: ${String(error)}`,
      {
        cause: error,
      },
    );
  }
}

/** The edges of a tree, once it has been shown to be the tree. */
async function scan(
  root: string,
  expected: readonly string[] = REQUIRED,
): Promise<Edge[]> {
  const files = await readTree(root);
  const missing = expected.filter(
    (name) => !files.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `the walk of ${root} found no ${missing.join(', ')}`,
    );
  }
  const edges = await Promise.all(
    files.map((file) => edgesFrom(file)),
  );
  return edges.flat();
}
/** The edges of the core tree and of the packages that left it. */
async function scanAll(): Promise<Edge[]> {
  return [
    ...(await scan(SOURCE)),
    ...(await scan(
      path.join(ROOT, 'packages', 'ws', 'src'),
      [],
    )),
    ...(await scan(
      path.join(ROOT, 'packages', 'socket-io', 'src'),
      [],
    )),
    ...(await scan(
      path.join(ROOT, 'packages', 'multipart', 'src'),
      [],
    )),
  ];
}

/** What a refused walk says, or the empty string if it did not. */
async function refusalOf(root: string): Promise<string> {
  try {
    await scan(root);
  } catch (error) {
    return String(error);
  }
  return '';
}

test('core reaching a feature is refused', () => {
  const forbidden = crossing(
    'src/core/body.ts',
    'src/features/sse.ts',
  );
  expect(coreReachesFeature([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('the two composition roots are the exception', () => {
  const cors = crossing(
    'src/core/hono-lifecycle.ts',
    'src/features/cors-middleware.ts',
  );
  expect(coreReachesFeature([cors])).toStrictEqual([]);
  const sse = crossing(
    'src/core/server-adapter.ts',
    'src/features/sse.ts',
  );
  expect(coreReachesFeature([sse])).toStrictEqual([]);
});

test('a feature reaching another feature is refused', () => {
  const forbidden = crossing(
    'src/features/views.ts',
    'src/features/sse.ts',
  );
  expect(featureReachesFeature([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('a feature reaching the ws island is refused', () => {
  const forbidden = crossing(
    'src/features/static-assets.ts',
    'packages/ws/src/adapter.ts',
  );
  expect(featureReachesWs([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('ws reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/ws/src/adapter.ts',
    'src/core/server-adapter.ts',
  );
  expect(wsReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the same edge as a type is erased, so it is allowed', () => {
  const erased = crossing(
    'packages/ws/src/adapter.ts',
    'src/core/server-adapter.ts',
    true,
  );
  expect(wsReachesApp([erased])).toStrictEqual([]);
});

test('the first three rules count a type import as an edge', () => {
  const typed = crossing(
    'src/core/body.ts',
    'src/features/sse.ts',
    true,
  );
  expect(coreReachesFeature([typed])).toStrictEqual([typed]);
  const alsoTyped = crossing(
    'src/features/views.ts',
    'src/features/sse.ts',
    true,
  );
  expect(featureReachesFeature([alsoTyped])).toStrictEqual([
    alsoTyped,
  ]);
  const stillTyped = crossing(
    'src/features/static-assets.ts',
    'packages/ws/src/adapter.ts',
    true,
  );
  expect(featureReachesWs([stillTyped])).toStrictEqual([
    stillTyped,
  ]);
});

test('the socket.io island reaching the application is refused', () => {
  const forbidden = crossing(
    'packages/socket-io/src/adapter.ts',
    'src/core/server-adapter.ts',
  );
  expect(socketIoReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('and refused as a type too, unlike the ws island', () => {
  const typed = crossing(
    'packages/socket-io/src/adapter.ts',
    'src/core/server-adapter.ts',
    true,
  );
  expect(socketIoReachesApp([typed])).toStrictEqual([typed]);
});

test.each([
  ['src/core/server-adapter.ts', false],
  ['src/core/server-adapter.ts', true],
  ['src/features/sse.ts', false],
  ['src/features/sse.ts', true],
] as const)(
  'nested socket.io modules reaching %s are refused (type only: %s)',
  (target, typeOnly) => {
    const forbidden = crossing(
      'src/socket-io/nested/helper.ts',
      target,
      typeOnly,
    );
    expect(socketIoReachesApp([forbidden])).toStrictEqual([
      forbidden,
    ]);
  },
);

test('no socket.io module reaches the application', async () => {
  expect(socketIoReachesApp(await scanAll())).toStrictEqual([]);
});

test('core reaches no feature outside the composition roots', async () => {
  expect(coreReachesFeature(await scanAll())).toStrictEqual([]);
});

test('no feature reaches another feature', async () => {
  expect(featureReachesFeature(await scanAll())).toStrictEqual(
    [],
  );
});

test('no feature reaches the ws island', async () => {
  expect(featureReachesWs(await scanAll())).toStrictEqual([]);
});

test('the ws island reaches the application through no value', async () => {
  expect(wsReachesApp(await scanAll())).toStrictEqual([]);
});

test('the upload island reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/multipart/src/storage/disk.storage.ts',
    'src/core/body.ts',
  );
  expect(multipartReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('the marker is the one value edge the island may take', () => {
  const marker = crossing(
    'packages/multipart/src/multipart/multipart.interceptor.factory.ts',
    'src/core/multipart.ts',
  );
  expect(multipartReachesApp([marker])).toStrictEqual([]);
});

test('every other edge the island takes is a type', () => {
  const erased = crossing(
    'packages/multipart/src/multipart/multipart.parser.ts',
    'src/core/request.ts',
    true,
  );
  expect(multipartReachesApp([erased])).toStrictEqual([]);
});

test('the upload island reaches the application through no value but the marker', async () => {
  expect(multipartReachesApp(await scanAll())).toStrictEqual(
    [],
  );
});

test('the upload island takes the application as a package', async () => {
  const edges = await scanAll();
  const intoApp = edges.filter(
    (edge) =>
      layerOf(edge.from) === 'multipart' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features'),
  );
  const manifest = await readFile(
    path.join(ROOT, 'packages', 'multipart', 'package.json'),
    'utf8',
  );
  expect(intoApp).toStrictEqual([]);
  expect(manifest).toContain('@ailura/nestjs-hono-adapter');
});

test('the ws island takes the application as a package, not as edges', async () => {
  const edges = await scanAll();
  const intoApp = edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features'),
  );
  const manifest = await readFile(
    path.join(ROOT, 'packages', 'ws', 'package.json'),
    'utf8',
  );
  expect(intoApp).toStrictEqual([]);
  expect(manifest).toContain('@ailura/nestjs-hono-adapter');
});

test('the walk reads an import out of every layer', async () => {
  const edges = [
    ...(await scanAll()),
    ...(await scan(
      path.join(ROOT, 'packages', 'socket-io', 'src'),
      [],
    )),
    ...(await scan(
      path.join(ROOT, 'packages', 'ws', 'src'),
      [],
    )),
  ];
  const layers = [
    ...new Set(edges.map((edge) => layerOf(edge.from))),
  ].filter((layer) => layer !== undefined);
  expect(layers.toSorted()).toStrictEqual([
    'core',
    'features',
    'multipart',
    'socket-io',
    'ws',
  ]);
});

test('a tree without the layers is refused, not read as empty', async () => {
  const refusal = await refusalOf(path.join(ROOT, 'test'));
  expect(refusal).toMatch(
    /found no src\/core\/hono-lifecycle\.ts/u,
  );
});

test('a tree that is not there is refused too', async () => {
  const refusal = await refusalOf(
    path.join(ROOT, 'src/no-such-layer'),
  );
  expect(refusal).toMatch(/read nothing/u);
});

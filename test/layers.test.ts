import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/**
 * The rules that keep `src/` layered, read off the source graph
 * rather than off a file list: `core/` holds the Nest to Hono
 * contract, `features/` the optional capabilities, and the
 * `ws-*` island is a world of its own behind `/ws`.
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
type Layer = 'core' | 'features' | 'ws';

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
  'src/features/cors-middleware.ts',
  'src/features/sse.ts',
  'src/features/static-assets.ts',
  'src/features/views.ts',
  'src/ws-adapter.ts',
  'src/ws-client.ts',
  'src/ws-server.ts',
  'src/ws.ts',
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

/** The layer a source path belongs to, and none for the roots. */
function layerOf(file: string): Layer | undefined {
  const directory = path.dirname(file);
  if (directory === 'src/core') {
    return 'core';
  }
  if (directory === 'src/features') {
    return 'features';
  }
  if (
    directory === 'src' &&
    path.basename(file).startsWith('ws')
  ) {
    return 'ws';
  }
  return undefined;
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
async function scan(root: string): Promise<Edge[]> {
  const files = await readTree(root);
  const missing = REQUIRED.filter(
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
    'src/ws-adapter.ts',
  );
  expect(featureReachesWs([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('ws reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'src/ws-adapter.ts',
    'src/core/server-adapter.ts',
  );
  expect(wsReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the same edge as a type is erased, so it is allowed', () => {
  const erased = crossing(
    'src/ws-adapter.ts',
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
    'src/ws-adapter.ts',
    true,
  );
  expect(featureReachesWs([stillTyped])).toStrictEqual([
    stillTyped,
  ]);
});

test('core reaches no feature outside the composition roots', async () => {
  expect(coreReachesFeature(await scan(SOURCE))).toStrictEqual(
    [],
  );
});

test('no feature reaches another feature', async () => {
  expect(
    featureReachesFeature(await scan(SOURCE)),
  ).toStrictEqual([]);
});

test('no feature reaches the ws island', async () => {
  expect(featureReachesWs(await scan(SOURCE))).toStrictEqual(
    [],
  );
});

test('the ws island reaches the application through no value', async () => {
  expect(wsReachesApp(await scan(SOURCE))).toStrictEqual([]);
});

test('the one edge from ws into the application is a type', async () => {
  const edges = await scan(SOURCE);
  const intoApp = edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features'),
  );
  expect(intoApp).toStrictEqual([
    {
      from: 'src/ws-adapter.ts',
      to: 'src/core/server-adapter.ts',
      typeOnly: true,
    },
  ]);
});

test('the walk reads an import out of every layer', async () => {
  const edges = await scan(SOURCE);
  const layers = [
    ...new Set(edges.map((edge) => layerOf(edge.from))),
  ].filter((layer) => layer !== undefined);
  expect(layers.toSorted()).toStrictEqual([
    'core',
    'features',
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

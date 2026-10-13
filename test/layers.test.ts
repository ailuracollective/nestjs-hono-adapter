import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

/**
 * The rules that keep `packages/core/src/` layered, read off
 * the source graph rather than off a file list: `core/` holds
 * the Nest to Hono contract, `features/` the optional
 * capabilities, and the three islands — `socket-io/` behind
 * `/socket-io`, the `ws-*` one behind `/ws` and `multipart/`
 * behind `/multipart` — are worlds of their own.
 *
 * Every rule already holds, so the scan has nothing to observe
 * today. What keeps this file alive is the synthetic crossings
 * below and the proof that the walk really read the tree: a
 * guard handed no `core/` and no `features/` would pass while
 * checking nothing at all.
 */

/** One source import, and whether it is a type or the marker. */
interface Edge {
  readonly from: string;
  readonly to: string;
  readonly typeOnly: boolean;
  readonly markerOnly?: boolean;
}

/** The layers of the tree, and the root is not one of them. */
type Layer =
  | 'core'
  | 'features'
  | 'multipart'
  | 'socket-io'
  | 'ws';

const ROOT = path.resolve(import.meta.dir, '..');
const SOURCE = path.join(ROOT, 'packages', 'core', 'src');
const CORE_PACKAGE = '@ailura/nestjs-hono-adapter';
const CORE_ENTRY = 'packages/core/src/index.ts';

/**
 * The two core modules that may name a feature, because they
 * are the composition roots: the one that mounts CORS, and the
 * one that binds the optional capabilities to the adapter. A
 * third core module naming a feature would be a layer that
 * cannot be reasoned about alone.
 */
const COMPOSITION_ROOTS = new Set([
  'packages/core/src/core/hono-lifecycle.ts',
  'packages/core/src/core/server-adapter.ts',
]);

/**
 * The modules a walk of `packages/core/src/` has to find. A
 * tree that is missing one has been renamed, not proven: the
 * scan refuses it instead of reading the absence as an absence
 * of crossings.
 */
const REQUIRED = [
  ...COMPOSITION_ROOTS,
  'packages/core/src/core/multipart.ts',
  'packages/core/src/features/cors-middleware.ts',
  'packages/core/src/features/sse.ts',
  'packages/core/src/features/static-assets.ts',
  'packages/core/src/features/views.ts',
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
  /^[ \t]*(?<statement>import|export)[ \t]+(?<typeOnly>type\b[ \t]*)?(?<bindings>[^;]*?)\bfrom\s+'(?<module>[^']+)'/gmu;

/** The relative module or core package a match named. */
function moduleOf(
  groups: Record<string, string> | undefined,
): string | undefined {
  if (groups === undefined) {
    return undefined;
  }
  const { module = '' } = groups;
  if (module !== CORE_PACKAGE && !module.startsWith('.')) {
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
  'packages/core/src/features': 'features',
  'packages/multipart/src': 'multipart',
  'packages/socket-io/src': 'socket-io',
  'packages/ws/src': 'ws',
};

/** The layer a source path belongs to, and none for the roots. */
function layerOf(file: string): Layer | undefined {
  const directory = path.dirname(file);
  if (
    file === CORE_ENTRY ||
    directory === 'packages/core/src/core'
  ) {
    return 'core';
  }
  if (directory.startsWith('packages/multipart/src/')) {
    return 'multipart';
  }
  if (directory.startsWith('packages/socket-io/src/')) {
    return 'socket-io';
  }
  return ISLANDS[directory];
}

/**
 * The edges a core module takes into a feature, excluding the
 * facade.
 */
function coreReachesFeature(edges: readonly Edge[]): Edge[] {
  return edges.filter(
    (edge) =>
      layerOf(edge.from) === 'core' &&
      edge.from !== CORE_ENTRY &&
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
 * graph stays inside `packages/multipart/src/` — the argument
 * rule 4 makes for `/ws`, with the one exception the marker
 * needs.
 */
const MULTIPART_VALUE_EDGE =
  'packages/core/src/core/multipart.ts';

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
      edge.to !== MULTIPART_VALUE_EDGE &&
      !(edge.to === CORE_ENTRY && edge.markerOnly === true),
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

/** The local imports in source text, resolved against its file. */
function edgesIn(source: string, file: string): Edge[] {
  const found: Edge[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const module = moduleOf(match.groups);
    if (module !== undefined) {
      let target = CORE_ENTRY;
      if (module.startsWith('.')) {
        target = path.join(path.dirname(file), module);
      }
      const { bindings = '', statement = '' } =
        match.groups ?? {};
      found.push({
        from: file,
        markerOnly:
          statement === 'import' &&
          /^\s*\{\s*declareMultipart(?:\s+as\s+[\w$]+)?\s*,?\s*\}\s*$/u.test(
            bindings,
          ),
        to: target,
        typeOnly: typeOnlyOf(match.groups),
      });
    }
  }
  return found;
}

/** The local imports of one file, resolved against it. */
async function edgesFrom(file: string): Promise<Edge[]> {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  return edgesIn(source, file);
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

test.each(['', 'type '])(
  'core package imports are scanned with their type flag (%s)',
  (type) => {
    const source = `import ${type}{ ServerAdapter } from '${CORE_PACKAGE}';`;
    const ws = edgesIn(source, 'packages/ws/src/adapter.ts');
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({
      to: CORE_ENTRY,
      typeOnly: type !== '',
    });
    expect(wsReachesApp(ws)).toHaveLength(Number(type === ''));
    const socketIo = edgesIn(
      source,
      'packages/socket-io/src/adapter.ts',
    );
    expect(socketIoReachesApp(socketIo)).toHaveLength(1);
    const multipart = edgesIn(
      source,
      'packages/multipart/src/multipart/multipart.parser.ts',
    );
    expect(multipartReachesApp(multipart)).toHaveLength(
      Number(type === ''),
    );
  },
);

test.each([
  ['import { declareMultipart }', true],
  ['import { declareMultipart as mark, }', true],
  ['import { ServerAdapter }', false],
  ['import { declareMultipart, ServerAdapter }', false],
  ['import * as core', false],
  ['export { declareMultipart }', false],
] as const)(
  'the multipart package marker exception checks its binding: %s',
  (binding, allowed) => {
    const edges = edgesIn(
      `${binding} from '${CORE_PACKAGE}';`,
      'packages/multipart/src/multipart/multipart.interceptor.factory.ts',
    );
    expect(edges).toHaveLength(1);
    expect(multipartReachesApp(edges)).toHaveLength(
      Number(!allowed),
    );
  },
);

test('core reaching a feature is refused', () => {
  const forbidden = crossing(
    'packages/core/src/core/body.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(coreReachesFeature([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('the two composition roots are the exception', () => {
  const cors = crossing(
    'packages/core/src/core/hono-lifecycle.ts',
    'packages/core/src/features/cors-middleware.ts',
  );
  expect(coreReachesFeature([cors])).toStrictEqual([]);
  const sse = crossing(
    'packages/core/src/core/server-adapter.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(coreReachesFeature([sse])).toStrictEqual([]);
});

test('a feature reaching another feature is refused', () => {
  const forbidden = crossing(
    'packages/core/src/features/views.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(featureReachesFeature([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('a feature reaching the ws island is refused', () => {
  const forbidden = crossing(
    'packages/core/src/features/static-assets.ts',
    'packages/ws/src/adapter.ts',
  );
  expect(featureReachesWs([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('ws reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/ws/src/adapter.ts',
    'packages/core/src/core/server-adapter.ts',
  );
  expect(wsReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the same edge as a type is erased, so it is allowed', () => {
  const erased = crossing(
    'packages/ws/src/adapter.ts',
    'packages/core/src/core/server-adapter.ts',
    true,
  );
  expect(wsReachesApp([erased])).toStrictEqual([]);
});

test('the first three rules count a type import as an edge', () => {
  const typed = crossing(
    'packages/core/src/core/body.ts',
    'packages/core/src/features/sse.ts',
    true,
  );
  expect(coreReachesFeature([typed])).toStrictEqual([typed]);
  const alsoTyped = crossing(
    'packages/core/src/features/views.ts',
    'packages/core/src/features/sse.ts',
    true,
  );
  expect(featureReachesFeature([alsoTyped])).toStrictEqual([
    alsoTyped,
  ]);
  const stillTyped = crossing(
    'packages/core/src/features/static-assets.ts',
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
    'packages/core/src/core/server-adapter.ts',
  );
  expect(socketIoReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('and refused as a type too, unlike the ws island', () => {
  const typed = crossing(
    'packages/socket-io/src/adapter.ts',
    'packages/core/src/core/server-adapter.ts',
    true,
  );
  expect(socketIoReachesApp([typed])).toStrictEqual([typed]);
});

test.each([
  ['packages/core/src/core/server-adapter.ts', false],
  ['packages/core/src/core/server-adapter.ts', true],
  ['packages/core/src/features/sse.ts', false],
  ['packages/core/src/features/sse.ts', true],
] as const)(
  'nested socket.io modules reaching %s are refused (type only: %s)',
  (target, typeOnly) => {
    const forbidden = crossing(
      'packages/socket-io/src/nested/helper.ts',
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
    'packages/core/src/core/body.ts',
  );
  expect(multipartReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('the marker is the one value edge the island may take', () => {
  const marker = crossing(
    'packages/multipart/src/multipart/multipart.interceptor.factory.ts',
    'packages/core/src/core/multipart.ts',
  );
  expect(multipartReachesApp([marker])).toStrictEqual([]);
});

test('every other edge the island takes is a type', () => {
  const erased = crossing(
    'packages/multipart/src/multipart/multipart.parser.ts',
    'packages/core/src/core/request.ts',
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
  expect(intoApp.length).toBeGreaterThan(0);
  expect(intoApp.every((edge) => edge.to === CORE_ENTRY)).toBe(
    true,
  );
  expect(manifest).toContain('@ailura/nestjs-hono-adapter');
});

test('the ws island takes the application as a package through types', async () => {
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
  expect(intoApp.length).toBeGreaterThan(0);
  expect(
    intoApp.every(
      (edge) => edge.to === CORE_ENTRY && edge.typeOnly,
    ),
  ).toBe(true);
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
    /found no packages\/core\/src\/core\/hono-lifecycle\.ts/u,
  );
});

test('a tree that is not there is refused too', async () => {
  const refusal = await refusalOf(
    path.join(ROOT, 'packages/core/src/no-such-layer'),
  );
  expect(refusal).toMatch(/read nothing/u);
});

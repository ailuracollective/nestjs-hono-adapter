import path from 'node:path';

/** One source import, and whether it is a type or the marker. */
interface Edge {
  /** The file the import is in. */
  readonly from: string;
  /** The module it names. */
  readonly to: string;
  /** Whether the statement is a type import. */
  readonly typeOnly: boolean;
  /** Whether it names only the multipart marker. */
  readonly markerOnly?: boolean;
}

/** The layers of the tree, and the root is not one of them. */
type Layer =
  | 'compat'
  | 'core'
  | 'features'
  | 'graphql'
  | 'multipart'
  | 'serve-static'
  | 'socket-io'
  | 'ws';

/** The repository root. */
const ROOT = path.resolve(import.meta.dir, '..', '..');
/** The adapter's source tree. */
const SOURCE = path.join(ROOT, 'packages', 'core', 'src');
/** The name the adapter core publishes under. */
const CORE_PACKAGE = '@ailura/nestjs-hono-adapter';
/** The adapter core's entry point, repository-relative. */
const CORE_ENTRY = 'packages/core/src/index.ts';

/**
 * The alias each source tree is named by, and the tree it
 * names.
 */
const ALIASES: Readonly<Record<string, string>> = {
  '#adapter/': 'packages/core/src/',
  '#graphql/': 'packages/graphql/src/',
  '#multipart/': 'packages/multipart/src/',
  '#serve-static/': 'packages/serve-static/src/',
  '#socket-io/': 'packages/socket-io/src/',
  '#test/': 'test/',
  '#ws/': 'packages/ws/src/',
};

/** The two core modules that may name a feature or a bridge. */
const COMPOSITION_ROOTS = new Set([
  'packages/core/src/core/server/hono-lifecycle.ts',
  'packages/core/src/core/server/server-adapter.ts',
]);

/** The modules a walk of the core tree has to find. */
const REQUIRED = [
  ...COMPOSITION_ROOTS,
  'packages/core/src/compat/index.ts',
  'packages/core/src/compat/peer-load.ts',
  'packages/core/src/compat/registry/index.ts',
  'packages/core/src/compat/registry/store.ts',
  'packages/core/src/compat/registry/settle.ts',
  'packages/core/src/compat/express/index.ts',
  'packages/core/src/compat/express/surface-fit.ts',
  'packages/core/src/core/multipart.ts',
  'packages/core/src/features/cors/index.ts',
  'packages/core/src/features/sse.ts',
  'packages/core/src/features/static-assets/index.ts',
  'packages/core/src/features/views/index.ts',
];

/**
 * The modules a walk of each bridge package has to find; the
 * entrypoint that publishes, and the bridge it holds.
 */
const BRIDGE_ENTRYPOINTS: Readonly<Record<string, string[]>> = {
  graphql: [
    'packages/graphql/src/index.ts',
    'packages/graphql/src/apollo.ts',
    'packages/graphql/src/route.ts',
  ],
  'serve-static': [
    'packages/serve-static/src/index.ts',
    'packages/serve-static/src/bridge.ts',
  ],
};

export {
  ALIASES,
  BRIDGE_ENTRYPOINTS,
  COMPOSITION_ROOTS,
  CORE_ENTRY,
  CORE_PACKAGE,
  REQUIRED,
  ROOT,
  SOURCE,
};
export type { Edge, Layer };

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
  | 'core'
  | 'features'
  | 'multipart'
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
  '#multipart/': 'packages/multipart/src/',
  '#socket-io/': 'packages/socket-io/src/',
  '#test/': 'test/',
  '#ws/': 'packages/ws/src/',
};

/** The two core modules that may name a feature. */
const COMPOSITION_ROOTS = new Set([
  'packages/core/src/core/server/hono-lifecycle.ts',
  'packages/core/src/core/server/server-adapter.ts',
]);

/** The modules a walk of the core tree has to find. */
const REQUIRED = [
  ...COMPOSITION_ROOTS,
  'packages/core/src/core/multipart.ts',
  'packages/core/src/features/cors/index.ts',
  'packages/core/src/features/sse.ts',
  'packages/core/src/features/static-assets/index.ts',
  'packages/core/src/features/views/index.ts',
];

export {
  ALIASES,
  COMPOSITION_ROOTS,
  CORE_ENTRY,
  CORE_PACKAGE,
  REQUIRED,
  ROOT,
  SOURCE,
};
export type { Edge, Layer };

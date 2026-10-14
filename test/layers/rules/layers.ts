import path from 'node:path';

import { COMPOSITION_ROOTS, CORE_ENTRY } from '#test/layers/model';
import type { Edge, Layer } from '#test/layers/model';

const crossing = (from: string, to: string, typeOnly = false): Edge => ({ from, to, typeOnly });

/**
 * Each region of the tree, the prefix it is rooted at, and the layer it belongs to. A region covers
 * its own directory and everything nested under it, which is why a module two folders deep still
 * reports as its island.
 */
const REGIONS: readonly (readonly [string, Layer])[] = [
  ['packages/core/src/core', 'core'],
  ['packages/core/src/features', 'features'],
  ['packages/core/src/compat', 'compat'],
  ['packages/graphql/src', 'graphql'],
  ['packages/multipart/src', 'multipart'],
  ['packages/serve-static/src', 'serve-static'],
  ['packages/socket-io/src', 'socket-io'],
  ['packages/ws/src', 'ws'],
];

const under = (directory: string, prefix: string): boolean =>
  directory === prefix || directory.startsWith(`${prefix}/`);

const layerOf = (file: string): Layer | undefined => {
  const directory = path.dirname(file);
  if (file === CORE_ENTRY) return 'core';
  for (const [prefix, layer] of REGIONS) {
    if (under(directory, prefix)) {
      return layer;
    }
  }
  return undefined;
};

const coreReachesFeature = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'core' &&
      edge.from !== CORE_ENTRY &&
      layerOf(edge.to) === 'features' &&
      !COMPOSITION_ROOTS.has(edge.from),
  );

const EXPRESS_SURFACE_CALLER = 'packages/core/src/core/route/handler-bridge/request.ts';

const EXPRESS_SURFACE = 'packages/core/src/compat/express/surface-fit.ts';

/**
 * The edges a core module takes into a compatibility bridge.
 *
 * `compat/` is the region that speaks for the platforms Nest users write against. It reaches
 * `core/` and `features/` freely — that is its job — but nothing reaches it sideways: only the two
 * composition roots may name it, exactly as only they may name a feature. The one further exception
 * is the request path, which names a bridge to fit the Express response surface onto a `@Res()`
 * object; `EXPRESS_SURFACE` is that seam and nothing else may take it.
 */
const coreReachesCompat = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'core' &&
      edge.from !== CORE_ENTRY &&
      layerOf(edge.to) === 'compat' &&
      !COMPOSITION_ROOTS.has(edge.from) &&
      !(edge.from === EXPRESS_SURFACE_CALLER && edge.to === EXPRESS_SURFACE),
  );

const capabilityOf = (file: string): string => {
  const rest = file.slice('packages/core/src/features/'.length);
  const [capability = rest] = rest.split('/');
  return capability.replace(/\.ts$/u, '');
};

export {
  EXPRESS_SURFACE,
  EXPRESS_SURFACE_CALLER,
  REGIONS,
  capabilityOf,
  coreReachesCompat,
  coreReachesFeature,
  crossing,
  layerOf,
};

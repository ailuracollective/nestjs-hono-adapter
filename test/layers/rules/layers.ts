import path from 'node:path';

import {
  COMPOSITION_ROOTS,
  CORE_ENTRY,
} from '#test/layers/model';
import type { Edge, Layer } from '#test/layers/model';

/** A crossing as a module would draw it, type-only when asked. */
const crossing = (
  from: string,
  to: string,
  typeOnly = false,
): Edge => ({ from, to, typeOnly });

/** The directory each island is rooted at, and its layer. */
const ISLANDS: Readonly<Record<string, Layer>> = {
  'packages/core/src/features': 'features',
  'packages/multipart/src': 'multipart',
  'packages/socket-io/src': 'socket-io',
  'packages/ws/src': 'ws',
};

/** The layer a source path belongs to, and none for the roots. */
const layerOf = (file: string): Layer | undefined => {
  const directory = path.dirname(file);
  if (
    file === CORE_ENTRY ||
    directory === 'packages/core/src/core' ||
    directory.startsWith('packages/core/src/core/')
  ) {
    return 'core';
  }
  if (
    directory === 'packages/core/src/features' ||
    directory.startsWith('packages/core/src/features/')
  ) {
    return 'features';
  }
  if (directory.startsWith('packages/multipart/src/')) {
    return 'multipart';
  }
  if (directory.startsWith('packages/socket-io/src/')) {
    return 'socket-io';
  }
  return ISLANDS[directory];
};

/** The edges a core module takes into a feature. */
const coreReachesFeature = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'core' &&
      edge.from !== CORE_ENTRY &&
      layerOf(edge.to) === 'features' &&
      !COMPOSITION_ROOTS.has(edge.from),
  );

/**
 * The capability a feature module belongs to, a folder or a
 * file.
 */
const capabilityOf = (file: string): string => {
  const rest = file.slice('packages/core/src/features/'.length);
  const [capability = rest] = rest.split('/');
  return capability.replace(/\.ts$/u, '');
};

export {
  ISLANDS,
  capabilityOf,
  coreReachesFeature,
  crossing,
  layerOf,
};

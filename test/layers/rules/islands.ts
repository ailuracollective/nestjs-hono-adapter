import { CORE_ENTRY } from '#test/layers/model';
import type { Edge } from '#test/layers/model';

import { capabilityOf, layerOf } from './layers.ts';

const featureReachesFeature = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'features' &&
      layerOf(edge.to) === 'features' &&
      capabilityOf(edge.from) !== capabilityOf(edge.to),
  );

const featureReachesWs = (edges: readonly Edge[]): Edge[] =>
  edges.filter((edge) => layerOf(edge.from) === 'features' && layerOf(edge.to) === 'ws');

const wsReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features') &&
      !edge.typeOnly,
  );

const MULTIPART_VALUE_EDGE = 'packages/core/src/core/multipart.ts';

const multipartReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'multipart' &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features') &&
      !edge.typeOnly &&
      edge.to !== MULTIPART_VALUE_EDGE &&
      !(edge.to === CORE_ENTRY && edge.markerOnly === true),
  );

const socketIoReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'socket-io' &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features'),
  );

const BRIDGE_LAYERS: ReadonlySet<string> = new Set(['graphql', 'serve-static']);

/**
 * The edges a bridge package takes into the adapter.
 *
 * A bridge lives outside the application and registers itself through the published entrypoint, so
 * that entrypoint is the only door it has: every name it needs — `Bridge`, `BridgeTarget`,
 * `NestContext`, `Transport`, `loadPeer`, `toHonoPath`, `toNestRequest` — is exported there. A
 * `#adapter/` import would be the same bridge reaching past the door into the tree behind it, which
 * is exactly what the region forbids sideways, and what would break the moment the tree moved.
 */
const bridgeReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      BRIDGE_LAYERS.has(layerOf(edge.from) ?? '') &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features') &&
      edge.to !== CORE_ENTRY,
  );

export {
  BRIDGE_LAYERS,
  bridgeReachesApp,
  featureReachesFeature,
  featureReachesWs,
  multipartReachesApp,
  socketIoReachesApp,
  wsReachesApp,
};

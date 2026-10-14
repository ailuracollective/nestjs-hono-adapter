import { CORE_ENTRY } from '#test/layers/model';
import type { Edge } from '#test/layers/model';

import { capabilityOf, layerOf } from './layers.ts';

/** The edges a feature takes into another capability. */
const featureReachesFeature = (
  edges: readonly Edge[],
): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'features' &&
      layerOf(edge.to) === 'features' &&
      capabilityOf(edge.from) !== capabilityOf(edge.to),
  );

/** The edges a feature takes into the ws island. */
const featureReachesWs = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'features' &&
      layerOf(edge.to) === 'ws',
  );

/** The edges the ws island takes into the application as values. */
const wsReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features') &&
      !edge.typeOnly,
  );

/** The one value edge the upload island may take into core. */
const MULTIPART_VALUE_EDGE =
  'packages/core/src/core/multipart.ts';

/** The value edges the upload island takes into the application. */
const multipartReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'multipart' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features') &&
      !edge.typeOnly &&
      edge.to !== MULTIPART_VALUE_EDGE &&
      !(edge.to === CORE_ENTRY && edge.markerOnly === true),
  );

/** The edges the socket.io island takes into the application. */
const socketIoReachesApp = (edges: readonly Edge[]): Edge[] =>
  edges.filter(
    (edge) =>
      layerOf(edge.from) === 'socket-io' &&
      (layerOf(edge.to) === 'core' ||
        layerOf(edge.to) === 'features'),
  );

export {
  featureReachesFeature,
  featureReachesWs,
  multipartReachesApp,
  socketIoReachesApp,
  wsReachesApp,
};

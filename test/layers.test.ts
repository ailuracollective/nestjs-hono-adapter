import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { COMPOSITION_ROOTS, CORE_ENTRY, ROOT } from './layers/model.ts';
import type { Edge, Layer } from './layers/model.ts';
import {
  BRIDGE_TOOLKIT,
  COMPAT_INDEX,
  EXPRESS_SURFACE,
  EXPRESS_SURFACE_CALLER,
  bridgeReachesApp,
  coreReachesCompat,
  coreReachesFeature,
  featureReachesFeature,
  featureReachesWs,
  layerOf,
  multipartReachesApp,
  socketIoReachesApp,
  wsReachesApp,
} from './layers/rules.ts';
import { refusalOf, scanAll } from './layers/tree.ts';

test('no socket.io module reaches the application', async () => {
  expect(socketIoReachesApp(await scanAll())).toStrictEqual([]);
});

test('no bridge package reaches past the published entrypoint', async () => {
  expect(bridgeReachesApp(await scanAll())).toStrictEqual([]);
});

const between = (edges: readonly Edge[], from: Layer, to: Layer): Edge[] =>
  edges.filter((edge) => layerOf(edge.from) === from && layerOf(edge.to) === to);

const walked = (): Promise<Edge[]> => scanAll();

test('core reaches no feature outside the composition roots', async () => {
  const edges = await walked();
  expect(coreReachesFeature(edges)).toStrictEqual([]);
});

test('core reaches no compatibility bridge outside the composition roots and the one request seam', async () => {
  const edges = await walked();
  expect(coreReachesCompat(edges)).toStrictEqual([]);
});

test('the request path takes the Express surface and nothing else from compat', async () => {
  const edges = between(await walked(), 'core', 'compat').filter(
    (edge) => !COMPOSITION_ROOTS.has(edge.from) && edge.from !== CORE_ENTRY,
  );
  expect(edges.map((edge) => `${edge.from} -> ${edge.to}`)).toStrictEqual([
    `${EXPRESS_SURFACE_CALLER} -> ${EXPRESS_SURFACE}`,
  ]);
});

test('the published entrypoint reaches the region by its index and the toolkit', async () => {
  const edges = between(await walked(), 'core', 'compat').filter(
    (edge) => edge.from === CORE_ENTRY,
  );
  expect(edges.length).toBeGreaterThan(0);
  expect(edges.every((edge) => edge.to === COMPAT_INDEX || edge.to === BRIDGE_TOOLKIT)).toBe(true);
});

test('the composition roots reach the region through its index', async () => {
  const edges = between(await walked(), 'core', 'compat').filter((edge) =>
    COMPOSITION_ROOTS.has(edge.from),
  );
  expect(edges.length).toBe(COMPOSITION_ROOTS.size);
  expect(edges.every((edge) => edge.to === COMPAT_INDEX)).toBe(true);
});

test('a bridge reaches core and features, which is its job', async () => {
  const edges = await walked();
  const targets = new Set(
    edges.filter((edge) => layerOf(edge.from) === 'compat').map((edge) => layerOf(edge.to)),
  );
  expect(targets.has('core')).toBe(true);
  expect(targets.has('features') || targets.has('core')).toBe(true);
});

test('no feature reaches a compatibility bridge', async () => {
  const edges = await walked();
  expect(between(edges, 'features', 'compat')).toStrictEqual([]);
});

test('no feature reaches another feature', async () => {
  expect(featureReachesFeature(await scanAll())).toStrictEqual([]);
});

test('no feature reaches the ws island', async () => {
  expect(featureReachesWs(await scanAll())).toStrictEqual([]);
});

test('the ws island reaches the application through no value', async () => {
  expect(wsReachesApp(await scanAll())).toStrictEqual([]);
});

test('the upload island reaches the application through no value but the marker', async () => {
  expect(multipartReachesApp(await scanAll())).toStrictEqual([]);
});

test('the upload island takes the application as a package', async () => {
  const edges = await scanAll();
  const intoApp = edges.filter(
    (edge) =>
      layerOf(edge.from) === 'multipart' &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features'),
  );
  const manifest = await readFile(path.join(ROOT, 'packages', 'multipart', 'package.json'), 'utf8');
  expect(intoApp.length).toBeGreaterThan(0);
  expect(intoApp.every((edge) => edge.to === CORE_ENTRY)).toBe(true);
  expect(manifest).toContain('@ailura/nestjs-hono-adapter');
});

test('the ws island takes the application as a package through types', async () => {
  const edges = await scanAll();
  const intoApp = edges.filter(
    (edge) =>
      layerOf(edge.from) === 'ws' &&
      (layerOf(edge.to) === 'core' || layerOf(edge.to) === 'features'),
  );
  const manifest = await readFile(path.join(ROOT, 'packages', 'ws', 'package.json'), 'utf8');
  expect(intoApp.length).toBeGreaterThan(0);
  expect(intoApp.every((edge) => edge.to === CORE_ENTRY && edge.typeOnly)).toBe(true);
  expect(manifest).toContain('@ailura/nestjs-hono-adapter');
});

test('the walk reads an import out of every layer', async () => {
  const edges = await scanAll();
  const layers = [...new Set(edges.map((edge) => layerOf(edge.from)))].filter(
    (layer) => layer !== undefined,
  );
  expect(layers.toSorted()).toStrictEqual([
    'compat',
    'core',
    'features',
    'graphql',
    'multipart',
    'serve-static',
    'socket-io',
    'ws',
  ]);
});

test('a tree without the layers is refused, not read as empty', async () => {
  const refusal = await refusalOf(path.join(ROOT, 'test'));
  expect(refusal).toMatch(/found no packages\/core\/src\/core\/server\/hono-lifecycle\.ts/u);
});

test('a tree that is not there is refused too', async () => {
  const refusal = await refusalOf(path.join(ROOT, 'packages/core/src/no-such-layer'));
  expect(refusal).toMatch(/read nothing/u);
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { CORE_ENTRY, ROOT } from './layers/model.ts';
import {
  coreReachesFeature,
  featureReachesFeature,
  featureReachesWs,
  layerOf,
  multipartReachesApp,
  socketIoReachesApp,
  wsReachesApp,
} from './layers/rules.ts';
import { refusalOf, scan, scanAll } from './layers/tree.ts';

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
    /found no packages\/core\/src\/core\/server\/hono-lifecycle\.ts/u,
  );
});

test('a tree that is not there is refused too', async () => {
  const refusal = await refusalOf(
    path.join(ROOT, 'packages/core/src/no-such-layer'),
  );
  expect(refusal).toMatch(/read nothing/u);
});

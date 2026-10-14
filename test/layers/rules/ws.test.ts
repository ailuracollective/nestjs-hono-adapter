import { expect, test } from 'bun:test';

import { bridgeReachesApp, crossing, featureReachesFeature } from '#test/layers/rules';

test('a feature reaching another feature is refused', () => {
  const forbidden = crossing(
    'packages/core/src/features/views/index.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(featureReachesFeature([forbidden])).toStrictEqual([forbidden]);
});

test('the ws bridge reaching past the published entrypoint is refused', () => {
  const forbidden = crossing(
    'packages/ws/src/patch.ts',
    'packages/core/src/core/server/server-adapter.ts',
  );
  expect(bridgeReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the same edge as a type is refused too, because a bridge has one door', () => {
  const erased = crossing(
    'packages/ws/src/patch.ts',
    'packages/core/src/core/server/server-adapter.ts',
    true,
  );
  expect(bridgeReachesApp([erased])).toStrictEqual([erased]);
});

test('the published entrypoint is that door', () => {
  const allowed = crossing('packages/ws/src/patch.ts', 'packages/core/src/index.ts');
  expect(bridgeReachesApp([allowed])).toStrictEqual([]);
});

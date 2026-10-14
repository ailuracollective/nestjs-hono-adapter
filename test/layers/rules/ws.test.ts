import { expect, test } from 'bun:test';

import {
  coreReachesFeature,
  crossing,
  featureReachesFeature,
  featureReachesWs,
  wsReachesApp,
} from '#test/layers/rules';

test('a feature reaching another feature is refused', () => {
  const forbidden = crossing(
    'packages/core/src/features/views/index.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(featureReachesFeature([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('a feature reaching the ws island is refused', () => {
  const forbidden = crossing(
    'packages/core/src/features/static-assets/index.ts',
    'packages/ws/src/adapter.ts',
  );
  expect(featureReachesWs([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('ws reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/ws/src/adapter.ts',
    'packages/core/src/core/server/server-adapter.ts',
  );
  expect(wsReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the same edge as a type is erased, so it is allowed', () => {
  const erased = crossing(
    'packages/ws/src/adapter.ts',
    'packages/core/src/core/server/server-adapter.ts',
    true,
  );
  expect(wsReachesApp([erased])).toStrictEqual([]);
});

test('the first three rules count a type import as an edge', () => {
  const typed = crossing(
    'packages/core/src/core/request/body/index.ts',
    'packages/core/src/features/sse.ts',
    true,
  );
  expect(coreReachesFeature([typed])).toStrictEqual([typed]);
  const alsoTyped = crossing(
    'packages/core/src/features/views/index.ts',
    'packages/core/src/features/sse.ts',
    true,
  );
  expect(featureReachesFeature([alsoTyped])).toStrictEqual([
    alsoTyped,
  ]);
  const stillTyped = crossing(
    'packages/core/src/features/static-assets/index.ts',
    'packages/ws/src/adapter.ts',
    true,
  );
  expect(featureReachesWs([stillTyped])).toStrictEqual([
    stillTyped,
  ]);
});

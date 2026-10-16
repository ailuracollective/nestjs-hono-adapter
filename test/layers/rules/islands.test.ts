import { expect, test } from 'bun:test';

import { bridgeReachesApp, crossing, multipartReachesApp } from '#test/layers/rules';

test('the upload island reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/multipart/src/storage/disk.storage.ts',
    'packages/core/src/core/request/body/index.ts',
  );
  expect(multipartReachesApp([forbidden])).toStrictEqual([forbidden]);
});

test('the marker is the one value edge the island may take', () => {
  const marker = crossing(
    'packages/multipart/src/multipart/multipart.interceptor.factory.ts',
    'packages/core/src/core/multipart.ts',
  );
  expect(multipartReachesApp([marker])).toStrictEqual([]);
});

test('every other edge the island takes is a type', () => {
  const erased = crossing(
    'packages/multipart/src/multipart/multipart.parser.ts',
    'packages/core/src/core/request/request.ts',
    true,
  );
  expect(multipartReachesApp([erased])).toStrictEqual([]);
});

test.each(['graphql', 'serve-static'])(
  'the %s bridge reaching past the published entrypoint is refused',
  (bridge) => {
    const forbidden = crossing(
      `packages/${bridge}/src/apollo-patch.ts`,
      'packages/core/src/core/context.ts',
    );
    expect(bridgeReachesApp([forbidden])).toStrictEqual([forbidden]);
  },
);

test('a bridge reaching an internal as a type is refused too', () => {
  const typed = crossing(
    'packages/serve-static/src/loader.ts',
    'packages/core/src/core/ports/transport.ts',
    true,
  );
  expect(bridgeReachesApp([typed])).toStrictEqual([typed]);
});

test('the published entrypoint is the one door a bridge has', () => {
  const published = crossing('packages/serve-static/src/index.ts', 'packages/core/src/index.ts');
  expect(bridgeReachesApp([published])).toStrictEqual([]);
});

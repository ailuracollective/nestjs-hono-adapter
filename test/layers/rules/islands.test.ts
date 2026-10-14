import { expect, test } from 'bun:test';

import {
  crossing,
  multipartReachesApp,
  socketIoReachesApp,
} from '#test/layers/rules';

test('the socket.io island reaching the application is refused', () => {
  const forbidden = crossing(
    'packages/socket-io/src/adapter.ts',
    'packages/core/src/core/server/server-adapter.ts',
  );
  expect(socketIoReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
});

test('and refused as a type too, unlike the ws island', () => {
  const typed = crossing(
    'packages/socket-io/src/adapter.ts',
    'packages/core/src/core/server/server-adapter.ts',
    true,
  );
  expect(socketIoReachesApp([typed])).toStrictEqual([typed]);
});

test.each([
  ['packages/core/src/core/server/server-adapter.ts', false],
  ['packages/core/src/core/server/server-adapter.ts', true],
  ['packages/core/src/features/sse.ts', false],
  ['packages/core/src/features/sse.ts', true],
] as const)(
  'nested socket.io modules reaching %s are refused (type only: %s)',
  (target, typeOnly) => {
    const forbidden = crossing(
      'packages/socket-io/src/nested/helper.ts',
      target,
      typeOnly,
    );
    expect(socketIoReachesApp([forbidden])).toStrictEqual([
      forbidden,
    ]);
  },
);
test('the upload island reaching the application is refused when it is a value', () => {
  const forbidden = crossing(
    'packages/multipart/src/storage/disk.storage.ts',
    'packages/core/src/core/request/body/index.ts',
  );
  expect(multipartReachesApp([forbidden])).toStrictEqual([
    forbidden,
  ]);
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

import { expect, test } from 'bun:test';

import { CORE_ENTRY, CORE_PACKAGE } from '#test/layers/model';
import {
  bridgeReachesApp,
  crossing,
  multipartReachesApp,
  socketIoReachesApp,
} from '#test/layers/rules';
import { edgesIn } from '#test/layers/tree';

test.each(['', 'type '])('core package imports are scanned with their type flag (%s)', (type) => {
  const source = `import ${type}{ ServerAdapter } from '${CORE_PACKAGE}';`;
  const socketIo = edgesIn(source, 'packages/socket-io/src/adapter.ts');
  expect(socketIoReachesApp(socketIo)).toHaveLength(1);
  const multipart = edgesIn(source, 'packages/multipart/src/multipart/multipart.parser.ts');
  expect(multipartReachesApp(multipart)).toHaveLength(Number(type === ''));
});

test('a bridge reaches the application through its entrypoint and nowhere past it', () => {
  const ws = edgesIn(`import { loadPeer } from '${CORE_PACKAGE}';`, 'packages/ws/src/patch.ts');
  expect(ws).toHaveLength(1);
  expect(ws[0]).toMatchObject({ to: CORE_ENTRY });
  expect(bridgeReachesApp(ws)).toStrictEqual([]);
  const past = crossing(
    'packages/ws/src/patch.ts',
    'packages/core/src/core/server/server-adapter.ts',
  );
  expect(bridgeReachesApp([past])).toHaveLength(1);
});

test.each([
  ['import { declareMultipart }', true],
  ['import { declareMultipart as mark, }', true],
  ['import { ServerAdapter }', false],
  ['import { declareMultipart, ServerAdapter }', false],
  ['import * as core', false],
  ['export { declareMultipart }', false],
] as const)('the multipart package marker exception checks its binding: %s', (binding, allowed) => {
  const edges = edgesIn(
    `${binding} from '${CORE_PACKAGE}';`,
    'packages/multipart/src/multipart/multipart.interceptor.factory.ts',
  );
  expect(edges).toHaveLength(1);
  expect(multipartReachesApp(edges)).toHaveLength(Number(!allowed));
});

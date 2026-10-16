import { expect, test } from 'bun:test';

import { coreReachesFeature, crossing } from '#test/layers/rules';
import { edgesIn } from '#test/layers/tree';

test('an alias names the file its relative form named', () => {
  const aliased = edgesIn(
    "import { corsBridge } from '#adapter/features/cors/index';",
    'packages/core/src/core/server/hono-lifecycle.ts',
  );
  expect(aliased).toStrictEqual(
    edgesIn(
      "import { corsBridge } from '../../features/cors/index.ts';",
      'packages/core/src/core/server/hono-lifecycle.ts',
    ),
  );
  expect(coreReachesFeature(aliased)).toStrictEqual([]);
});

test('an unmatched hash specifier is no edge at all', () => {
  expect(
    edgesIn(
      "import { x } from '@nestjs/common';",
      'packages/core/src/core/server/hono-lifecycle.ts',
    ),
  ).toStrictEqual([]);
});

test('core reaching a feature is refused', () => {
  const forbidden = crossing(
    'packages/core/src/core/request/body/index.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(coreReachesFeature([forbidden])).toStrictEqual([forbidden]);
});

test('the two composition roots are the exception', () => {
  const cors = crossing(
    'packages/core/src/core/server/hono-lifecycle.ts',
    'packages/core/src/features/cors/index.ts',
  );
  expect(coreReachesFeature([cors])).toStrictEqual([]);
  const sse = crossing(
    'packages/core/src/core/server/server-adapter.ts',
    'packages/core/src/features/sse.ts',
  );
  expect(coreReachesFeature([sse])).toStrictEqual([]);
});

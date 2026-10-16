import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchApolloDriver } from './apollo-patch.ts';

const bridge: Bridge = {
  install: (target) => patchApolloDriver(target),
  name: 'graphql/apollo',
};

export { bridge };

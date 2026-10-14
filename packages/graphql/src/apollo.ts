import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchApolloDriver } from './apollo-patch.ts';

const bridge: Bridge = {
  install: async () => {
    await patchApolloDriver();
  },
  name: 'graphql/apollo',
};

export { bridge };

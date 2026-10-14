import type { Bridge } from '@ailura/nestjs-hono-adapter';

import { patchApolloDriver } from './apollo-patch.ts';

/**
 * Lets the stock `ApolloDriver` answer on Hono, replacing the
 * one branch that refuses it.
 */
const bridge: Bridge = {
  install: async () => {
    await patchApolloDriver();
  },
  name: 'graphql/apollo',
};

export { bridge };

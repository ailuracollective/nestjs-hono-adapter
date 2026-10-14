import { loadPeer } from '@ailura/nestjs-hono-adapter';

import type { ApolloServer } from './apollo-handler.ts';

/** The engine class, as the bridge constructs it. */
type EngineConstructor = new (options: unknown) => object;

/** The members the engine module carries that the bridge calls. */
interface EngineModule {
  readonly ApolloServer: EngineConstructor;
}

/** The engine instance, as the handler calls it. */
interface EngineInstance extends ApolloServer {
  start: () => Promise<void>;
}

/** Whether a loaded module is an object the bridge can read. */
const isCarrier = (
  loaded: unknown,
): loaded is Record<string, unknown> =>
  typeof loaded === 'object' && loaded !== null;

/** Whether a loaded module carries Apollo's engine class. */
const isEngineModule = (
  loaded: unknown,
): loaded is EngineModule =>
  isCarrier(loaded) &&
  typeof loaded.ApolloServer === 'function';

/** Whether the engine carries the members the bridge calls. */
const isEngineInstance = (
  built: object,
): built is EngineInstance =>
  typeof Reflect.get(built, 'executeHTTPGraphQLRequest') ===
    'function' &&
  typeof Reflect.get(built, 'start') === 'function';

/**
 * Resolves one engine peer. It has to be the copy the
 * application resolved: `graphql` refuses another.
 */
const engine = async (): Promise<EngineModule | undefined> => {
  const loaded = await loadPeer('@apollo/server');
  return isEngineModule(loaded) ? loaded : undefined;
};

export { engine, isEngineInstance };
export type { EngineInstance, EngineModule };

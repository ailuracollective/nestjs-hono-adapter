import { loadPeer } from '@ailura/nestjs-hono-adapter';

import type { ApolloServer } from './apollo-handler.ts';

type EngineConstructor = new (options: unknown) => object;

interface EngineModule {
  readonly ApolloServer: EngineConstructor;
}

interface EngineInstance extends ApolloServer {
  start: () => Promise<void>;
}

const isCarrier = (loaded: unknown): loaded is Record<string, unknown> =>
  typeof loaded === 'object' && loaded !== null;

const isEngineModule = (loaded: unknown): loaded is EngineModule =>
  isCarrier(loaded) && typeof loaded.ApolloServer === 'function';

const isEngineInstance = (built: object): built is EngineInstance =>
  typeof Reflect.get(built, 'executeHTTPGraphQLRequest') === 'function' &&
  typeof Reflect.get(built, 'start') === 'function';

/**
 * Resolves one engine peer. It has to be the copy the application resolved: `graphql` refuses
 * another.
 */
const engine = async (): Promise<EngineModule | undefined> => {
  const loaded = await loadPeer('@apollo/server');
  return isEngineModule(loaded) ? loaded : undefined;
};

export { engine, isEngineInstance };
export type { EngineInstance, EngineModule };

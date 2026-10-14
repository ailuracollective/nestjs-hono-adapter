import type { ApolloServer } from './apollo-handler.ts';
import type { EngineModule } from './apollo-server-peers.ts';
import {
  engine,
  isEngineInstance,
} from './apollo-server-peers.ts';
import type { ApolloDriverConfig } from './peer-shapes.ts';

/**
 * The engine's configuration: what was named, plus whatever the
 * bridge adds. Copied, not spread, because the record is open.
 */
const configurationOf = (
  options: ApolloDriverConfig,
): Record<string, unknown> => {
  const configuration: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(options)) {
    configuration[name] = value;
  }
  return configuration;
};

/**
 * Builds the Apollo server and starts it. No drain plugin: the
 * adapter closes its own server.
 */
const buildApolloServer = async (
  options: ApolloDriverConfig,
): Promise<ApolloServer | undefined> => {
  const engineModule: EngineModule | undefined = await engine();
  if (engineModule === undefined) {
    return undefined;
  }
  const built = new engineModule.ApolloServer(
    configurationOf(options),
  );
  if (!isEngineInstance(built)) {
    return undefined;
  }
  await built.start();
  return built;
};

export { buildApolloServer };

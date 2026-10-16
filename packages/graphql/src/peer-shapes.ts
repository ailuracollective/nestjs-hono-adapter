/**
 * The shapes the bridge reads out of `@nestjs/graphql`'s drivers, which are platform-bound where
 * the module is not.
 */
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const GRAPHQL_METHODS: readonly string[] = ['GET', 'POST', 'OPTIONS'];

const DEFAULT_GRAPHQL_PATH = '/graphql';

const DEFAULT_STATUS: ContentfulStatusCode = 200;

interface DriverHost {
  httpAdapterHost?: { httpAdapter?: unknown };
}

interface DriverAdapter {
  readonly hono: () => unknown;
  readonly type: () => string;
  readonly server: () => unknown;
}

interface ApolloDriverConfig {
  readonly context?: unknown;
  readonly path?: string;
  readonly plugins?: readonly unknown[];
  readonly [option: string]: unknown;
}

type ApolloRegisterServer = (options: ApolloDriverConfig) => Promise<void>;

interface ApolloDriverShape extends DriverHost {
  apolloServer?: unknown;
  registerServer: ApolloRegisterServer;
}

interface DriverConstructor {
  readonly prototype: ApolloDriverShape;
}

interface ApolloPeer {
  readonly ApolloDriver?: DriverConstructor;
}

export { DEFAULT_GRAPHQL_PATH, DEFAULT_STATUS, GRAPHQL_METHODS };
export type {
  ApolloDriverConfig,
  ApolloDriverShape,
  ApolloPeer,
  ApolloRegisterServer,
  DriverAdapter,
  DriverConstructor,
  DriverHost,
};

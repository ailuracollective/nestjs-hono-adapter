/**
 * The shapes the bridge reads out of `@nestjs/graphql`'s
 * drivers, which are platform-bound where the module is not.
 */
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** The methods both drivers mount a GraphQL endpoint for. */
const GRAPHQL_METHODS: readonly string[] = [
  'GET',
  'POST',
  'OPTIONS',
];

/** The path a driver answers on when the deployment named none. */
const DEFAULT_GRAPHQL_PATH = '/graphql';

/** The status an answer carries when the engine named none. */
const DEFAULT_STATUS: ContentfulStatusCode = 200;

/** The host Nest injects into a driver. */
interface DriverHost {
  httpAdapterHost?: { httpAdapter?: unknown };
}

/**
 * The adapter a driver is holding. Closures, not lifted
 * methods: `getHono()` reads `this.hono`.
 */
interface DriverAdapter {
  /** Calls `getHono()` on the adapter, with it as the receiver. */
  readonly hono: () => unknown;
  /** Calls `getType()` on the adapter, with it as the receiver. */
  readonly type: () => string;
  /**
   * Calls `getHttpServer()` on the adapter, with it as the
   * receiver.
   */
  readonly server: () => unknown;
}

/** The configuration `@nestjs/apollo` hands its driver. */
interface ApolloDriverConfig {
  readonly context?: unknown;
  readonly path?: string;
  readonly plugins?: readonly unknown[];
  readonly [option: string]: unknown;
}

/** The `registerServer` the bridge replaces, before it does. */
type ApolloRegisterServer = (
  options: ApolloDriverConfig,
) => Promise<void>;

/** The `ApolloDriver` members the bridge replaces or calls. */
interface ApolloDriverShape extends DriverHost {
  /** The server the driver keeps, as Nest reads it. */
  apolloServer?: unknown;
  /** The method the bridge replaces. */
  registerServer: ApolloRegisterServer;
}

/** A driver class, as the bridge reads one off a peer. */
interface DriverConstructor {
  readonly prototype: ApolloDriverShape;
}

/** The peer shape the bridge reads out of `@nestjs/apollo`. */
interface ApolloPeer {
  readonly ApolloDriver?: DriverConstructor;
}

export {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_STATUS,
  GRAPHQL_METHODS,
};
export type {
  ApolloDriverConfig,
  ApolloDriverShape,
  ApolloPeer,
  ApolloRegisterServer,
  DriverAdapter,
  DriverConstructor,
  DriverHost,
};

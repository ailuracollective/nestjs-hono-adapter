/** The shapes the bridge reads out of `graphql-ws`, and the options `@nestjs/graphql` hands it. */
const CLOSED = 1000;

/** What `graphql-ws` reads off a socket: its core drives these four and nothing else. */
interface GraphQLSocket {
  readonly protocol: string;
  readonly send: (message: string) => void;
  readonly close: (code: number, reason: string) => void;
  readonly onMessage: (answer: (data: string) => void) => void;
}

interface GraphQLServer {
  readonly opened: (
    socket: GraphQLSocket,
    extra: unknown,
  ) => (code: number, reason: string) => void;
}

interface GraphQLPeer {
  readonly GRAPHQL_TRANSPORT_WS_PROTOCOL: string;
  readonly makeServer: (options: Record<string, unknown>) => GraphQLServer;
}

interface SubscriptionOptions {
  readonly schema?: unknown;
  readonly execute?: unknown;
  readonly subscribe?: unknown;
  readonly context?: unknown;
  readonly path?: string;
  readonly 'graphql-ws'?: unknown;
}

const isCarrier = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCloseEvent = (
  value: unknown,
): value is { readonly code: number; readonly reason: string } =>
  isCarrier(value) && typeof value.code === 'number' && typeof value.reason === 'string';

const isGraphQLPeer = (value: unknown): value is GraphQLPeer =>
  isCarrier(value) &&
  typeof value.makeServer === 'function' &&
  typeof value.GRAPHQL_TRANSPORT_WS_PROTOCOL === 'string';

const wsOptionsOf = (options: SubscriptionOptions): Record<string, unknown> =>
  isCarrier(options['graphql-ws']) ? options['graphql-ws'] : {};

const pathOf = (options: SubscriptionOptions, fallback: string): string => {
  const own = wsOptionsOf(options).path;
  return typeof own === 'string' ? own : (options.path ?? fallback);
};

export { CLOSED, isCarrier, isCloseEvent, isGraphQLPeer, pathOf, wsOptionsOf };
export type { GraphQLPeer, GraphQLServer, GraphQLSocket, SubscriptionOptions };

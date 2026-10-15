import type { MiddlewareHandler } from 'hono';
import type { WSContext } from 'hono/ws';

import { toHonoPath } from '@ailura/nestjs-hono-adapter';
import type {
  BridgeTarget,
  NestEnv,
  WebSocketEvents,
  WebSocketSupport,
} from '@ailura/nestjs-hono-adapter';

import { CLOSED, isCloseEvent, pathOf, wsOptionsOf } from './apollo-socket-shapes.ts';
import type { GraphQLPeer, GraphQLServer, SubscriptionOptions } from './apollo-socket-shapes.ts';
import { DEFAULT_GRAPHQL_PATH } from './peer-shapes.ts';

interface SubscriptionMount {
  readonly options: SubscriptionOptions;
  readonly peer: GraphQLPeer;
  readonly support: WebSocketSupport;
  readonly target: BridgeTarget;
}

/** The events one socket drives: `graphql-ws` opens its client on the first one that fires. */
const eventsFor = (server: GraphQLServer, peer: GraphQLPeer) => (): WebSocketEvents => {
  let answer: ((data: string) => void) | undefined = undefined;
  let closed: ((code: number, reason: string) => void) | undefined = undefined;
  const open = (socket: WSContext): void => {
    if (closed !== undefined) return;
    closed = server.opened(
      {
        close: (code, reason) => {
          socket.close(code, reason);
        },
        onMessage: (deliver) => {
          answer = deliver;
        },
        protocol: peer.GRAPHQL_TRANSPORT_WS_PROTOCOL,
        send: (message) => {
          socket.send(message);
        },
      },
      { socket: socket.raw },
    );
  };
  return {
    onClose: (event, socket) => {
      open(socket);
      if (closed === undefined) return;
      if (isCloseEvent(event)) closed(event.code, event.reason);
      else closed(CLOSED, '');
    },
    onMessage: (event, socket) => {
      open(socket);
      if (answer !== undefined) answer(String(event.data));
    },
    onOpen: (_event, socket) => {
      open(socket);
    },
  };
};

const routeFor = (mount: SubscriptionMount, server: GraphQLServer): MiddlewareHandler<NestEnv> =>
  mount.support.upgradeWebSocket(eventsFor(server, mount.peer));

/**
 * The server and the upgrade route for one application's subscriptions path: the stock service
 * feeds a `ws` server from `httpServer.on('upgrade')`, and here the transport's helper feeds
 * `graphql-ws`.
 */
const serveSubscriptions = (mount: SubscriptionMount): void => {
  const { options, peer, support, target } = mount;
  const server = peer.makeServer({
    context: options.context,
    execute: options.execute,
    schema: options.schema,
    subscribe: options.subscribe,
    ...wsOptionsOf(options),
  });
  support.install(target.server());
  target.hono.get(toHonoPath(pathOf(options, DEFAULT_GRAPHQL_PATH)), routeFor(mount, server));
};

export { serveSubscriptions };
export type { SubscriptionMount };

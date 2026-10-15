import { loadPeer } from '@ailura/nestjs-hono-adapter';
import type { BridgeTarget, Server } from '@ailura/nestjs-hono-adapter';

import { serveSubscriptions } from './apollo-subscription-route.ts';
import { isCarrier, isGraphQLPeer } from './apollo-socket-shapes.ts';
import type { GraphQLPeer, SubscriptionOptions } from './apollo-socket-shapes.ts';

const PEER = '@nestjs/graphql';

const WS_PEER = 'graphql-ws';

interface SubscriptionServiceShape {
  readonly httpServer: Server;
  readonly options: SubscriptionOptions;
  initialize: () => void;
}

const patched = new WeakSet<object>();

const targets: BridgeTarget[] = [];

const remember = (target: BridgeTarget): void => {
  if (!targets.some((one) => one.hono === target.hono)) targets.push(target);
};

const isService = (value: unknown): value is SubscriptionServiceShape =>
  isCarrier(value) && typeof value.initialize === 'function';

const isConstructor = (value: unknown): value is { readonly prototype: unknown } =>
  typeof value === 'function';

const prototypeOf = async (): Promise<SubscriptionServiceShape | undefined> => {
  const peer = await loadPeer(PEER);
  const service = isCarrier(peer) ? peer.GqlSubscriptionService : undefined;
  if (!isConstructor(service) || !isService(service.prototype)) return undefined;
  return service.prototype;
};

/**
 * `initialize()` is the one member that wires a subscriptions server, so replacing it is the whole
 * bridge; the stock service keeps `stop()` and the `ws` server it never gets to use.
 */
const fit = (prototype: SubscriptionServiceShape, peer: GraphQLPeer): void => {
  const original = prototype.initialize;
  prototype.initialize = function initialize(this: SubscriptionServiceShape): void {
    const target = targets.find((one) => one.server() === this.httpServer);
    const create = target === undefined ? undefined : target.transport.createWebSocket;
    // Without a websocket helper the transport is Node's own server, where `ws` still fits.
    if (target === undefined || create === undefined || !('graphql-ws' in this.options)) {
      original.call(this);
      return;
    }
    serveSubscriptions({
      options: this.options,
      peer,
      support: create(target.hono),
      target,
    });
  };
};

/**
 * Serves subscriptions through the transport's own websocket helper where it carries one, and
 * leaves Node's own server to the stock service.
 */
const patchSubscriptions = async (target: BridgeTarget): Promise<void> => {
  remember(target);
  const prototype = await prototypeOf();
  if (prototype === undefined || patched.has(prototype)) return;
  const peer = await loadPeer(WS_PEER);
  if (!isGraphQLPeer(peer)) return;
  patched.add(prototype);
  fit(prototype, peer);
};

export { patchSubscriptions };

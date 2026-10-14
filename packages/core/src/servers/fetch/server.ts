/* eslint-disable unicorn/prefer-event-target */

import { EventEmitter } from 'node:events';

import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type {
  StaticOptions,
  WebSocketSupport,
} from '#adapter/core/ports/transport';

/** A static-asset middleware the host provides. */
type StaticHandler = (
  options: StaticOptions,
) => MiddlewareHandler<NestEnv>;

/** The host's websocket helper, when it has one. */
type WebSocketFactory = (app: NestHono) => WebSocketSupport;

/** The upgrade helper a fetch host publishes for its websockets. */
type HostWebSocket = WebSocketSupport['upgradeWebSocket'];

interface FetchServerOptions {
  /** The host's static-asset middleware, when it has one. */
  readonly serveStatic?: StaticHandler;
  /** The host's websocket helper, when it has one. */
  readonly upgradeWebSocket?: WebSocketFactory;
}

/** The error `listen()` is answered with. */
const LISTEN_REFUSAL =
  'The fetch transport cannot listen: the fetch host owns the ' +
  'request loop. Export fetchHandler() and give it to the host.';

/** Nothing for a fetch host to release. */
const noDisposer = (): void => {
  // A fetch host is handed requests; it does not hold a server.
};

/** Builds the `upgradeWebSocket` option from the host's helper. */
const webSocketFromHost =
  (upgradeWebSocket: HostWebSocket): WebSocketFactory =>
  () => ({
    install: () => noDisposer,
    upgradeWebSocket,
  });

/** The server Nest drives on a fetch host. */
class FetchServer extends EventEmitter implements Server {
  /** Answers a listen with the refusal it cannot fulfil. */
  public listen(
    _port?: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    let answer: ((error: Error) => void) | undefined = callback;
    if (typeof hostnameOrCallback === 'function') {
      answer = hostnameOrCallback;
    }
    const refusal = new Error(LISTEN_REFUSAL);
    if (answer === undefined) {
      throw refusal;
    }
    answer(refusal);
  }

  /** A fetch host stops itself; there is no server to close. */
  public close(): Promise<void> {
    return Promise.resolve();
  }

  /** A fetch host has no address; the platform routes to it. */
  public address(): undefined {
    return undefined;
  }
}

export { FetchServer, webSocketFromHost };
export type {
  FetchServerOptions,
  HostWebSocket,
  StaticHandler,
  WebSocketFactory,
};

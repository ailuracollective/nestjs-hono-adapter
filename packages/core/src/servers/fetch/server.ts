/* eslint-disable unicorn/prefer-event-target */

import { EventEmitter } from 'node:events';

import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { StaticOptions, WebSocketSupport } from '#adapter/core/ports/transport';

type StaticHandler = (options: StaticOptions) => MiddlewareHandler<NestEnv>;

type WebSocketFactory = (app: NestHono) => WebSocketSupport;

type HostWebSocket = WebSocketSupport['upgradeWebSocket'];

interface FetchServerOptions {
  readonly serveStatic?: StaticHandler;
  readonly upgradeWebSocket?: WebSocketFactory;
}

const LISTEN_REFUSAL =
  'The fetch transport cannot listen: the fetch host owns the ' +
  'request loop. Export fetchHandler() and give it to the host.';

const noDisposer = (): void => {
  // A fetch host is handed requests; it does not hold a server.
};

const webSocketFromHost =
  (upgradeWebSocket: HostWebSocket): WebSocketFactory =>
  () => ({
    install: () => noDisposer,
    upgradeWebSocket,
  });

class FetchServer extends EventEmitter implements Server {
  public listen(
    _port?: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    let answer: ((error: Error) => void) | undefined = callback;
    if (typeof hostnameOrCallback === 'function') answer = hostnameOrCallback;
    const refusal = new Error(LISTEN_REFUSAL);
    if (answer === undefined) throw refusal;
    answer(refusal);
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  public address(): undefined {
    return undefined;
  }
}

export { FetchServer, webSocketFromHost };
export type { FetchServerOptions, HostWebSocket, StaticHandler, WebSocketFactory };

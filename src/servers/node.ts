import { createServer as createHttpsServer } from 'node:https';
import type { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';

import type { NestEnv, NestHono } from '../core/context.ts';
import type { Server } from '../core/server.ts';
import type {
  ServerOptions,
  StaticOptions,
  Transport,
} from '../core/transport.ts';

/**
 * The Node transport: the runtime-specific half of the adapter,
 * reached through the `./node-server` subpath. It builds the
 * server Nest drives over `@hono/node-server`, which attaches
 * the Node request and response to every Hono context and
 * serves files with the same package's static middleware.
 *
 * The adapter serves through it whenever a deployment named no
 * other transport: it is the runtime this package served
 * through before the transports split, and it runs on Bun as
 * well as on Node.
 */

/** The options `@hono/node-server` accepts to build the server. */
type AdaptorOptions = Parameters<typeof createAdaptorServer>[0];

/** What `nodeServer` accepts beyond the adapter's own options. */
interface NodeServerOptions {
  /**
   * Whether `@hono/node-server` may replace the global
   * `Request` and `Response` with its lighter classes, worth
   * roughly a third of the CPU an answer costs. Off by default:
   * the replacement is process-wide and not restored, which a
   * library should not do unless asked. The adapter turns it on
   * for the transport it picks itself, which is the behaviour
   * every deployment had before the transports split.
   */
  readonly overrideGlobalObjects?: boolean;
}

/** Says whether a close failure only means the server never ran. */
function isNotRunning(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_SERVER_NOT_RUNNING'
  );
}

/** The callback Node's own `close` answers through. */
type CloseCallback = (error?: Error) => void;

/** The `listen` shapes Nest drives a server with. */
interface Listenable {
  listen: (
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ) => void;
}

/**
 * Replaces `listen` with a form that takes every shape Nest
 * calls it in: the runtime's own overloads do not all accept
 * the position Nest puts the hostname or the callback in.
 */
function adaptListen(native: HttpServer): void {
  const listen = native.listen.bind(native);
  const server = native as unknown as Listenable;
  server.listen = (
    port,
    hostnameOrCallback,
    callback,
  ): void => {
    const args: unknown[] = [port];
    if (hostnameOrCallback !== undefined) {
      args.push(hostnameOrCallback);
    }
    if (callback !== undefined) {
      args.push(callback);
    }
    Reflect.apply(listen, undefined, args);
  };
}

/**
 * Replaces `close` with the promise the port answers through,
 * draining the connections the server still holds when asked. A
 * server that never listened has nothing to close, so that
 * error is not propagated, and a Node caller that passed a
 * callback of its own still can.
 */
function adaptClose(native: HttpServer): void {
  const close = native.close.bind(native);
  const server = native as unknown as {
    close: (
      closeActiveConnections?: boolean | CloseCallback,
    ) => Promise<void>;
  };
  server.close = async (
    closeActiveConnections = false,
  ): Promise<void> => {
    if (typeof closeActiveConnections === 'function') {
      // oxlint-disable-next-line promise/avoid-new -- a Node caller's callback is settled from outside this body, which is what a deferred is; an `async` form would resolve before it answers.
      await new Promise<void>((resolve, reject) => {
        close((error?: Error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
      return;
    }
    if (
      closeActiveConnections &&
      typeof native.closeAllConnections === 'function'
    ) {
      native.closeAllConnections();
    }
    try {
      await promisify((done: () => void) => {
        close(done);
      })();
    } catch (error) {
      if (!isNotRunning(error)) {
        throw error;
      }
    }
  };
}

/**
 * Hands back Node's own server with those two members adapted
 * onto it. Everything else is the object `getHttpServer()`
 * answered before the transports split —
 * `closeAllConnections()`, `listeners('upgrade')`, `address()`
 * — so a deployment that reached for one of them keeps reaching
 * it.
 */
function asServer(native: HttpServer): Server {
  adaptListen(native);
  adaptClose(native);
  return native as unknown as Server;
}

/** Builds the server Nest drives over `@hono/node-server`. */
function createNodeServer(
  app: NestHono,
  options: ServerOptions,
  transport: NodeServerOptions,
): Server {
  const adaptor: Record<string, unknown> = {
    fetch: app.fetch,
    overrideGlobalObjects:
      transport.overrideGlobalObjects ?? false,
  };
  const certificate = options.httpsOptions;
  if (certificate !== undefined) {
    adaptor.createServer = createHttpsServer;
    adaptor.serverOptions = certificate;
  }
  const server = createAdaptorServer(
    adaptor as unknown as AdaptorOptions,
  ) as unknown as HttpServer;
  return asServer(server);
}

/**
 * The middleware that serves one directory with
 * `@hono/node-server`.
 */
function nodeServeStatic(
  options: StaticOptions,
): MiddlewareHandler<NestEnv> {
  const config: Record<string, unknown> = {
    index: options.index,
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined) {
    config.rewriteRequestPath = options.rewriteRequestPath;
  }
  return serveStatic(
    config as unknown as Parameters<typeof serveStatic>[0],
  ) as MiddlewareHandler<NestEnv>;
}

/**
 * The Node transport, for `new ServerAdapter({ transport })`,
 * and the one the adapter serves through when a deployment
 * names no other. It carries no websocket helper: the `/ws`
 * island falls back to `@hono/node-ws`, so a deployment that
 * serves no websocket never installs it.
 */
function nodeServer(
  options: NodeServerOptions = {},
): Transport {
  return {
    createServer: (app, serverOptions) =>
      createNodeServer(app, serverOptions, options),
    serveStatic: nodeServeStatic,
  };
}

export { nodeServer };
export type { NodeServerOptions };

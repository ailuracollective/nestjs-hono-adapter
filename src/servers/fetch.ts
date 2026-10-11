import { EventEmitter } from 'node:events';

import type { MiddlewareHandler } from 'hono';

import { RequestCarrier } from '../core/bindings.ts';
import type { NestEnv, NestHono } from '../core/context.ts';
import type { Server } from '../core/server.ts';
import type {
  StaticOptions,
  Transport,
  WebSocketSupport,
} from '../core/transport.ts';

/**
 * The fetch transport: the half of the adapter for a host that
 * serves a Web `Request` and expects a Web `Response` —
 * Cloudflare Workers, Vercel Functions, Deno, Bun's `fetch`
 * export. Nothing listens on a port; the deployment exports
 * {@link fetchHandler}.
 *
 * The `Server` Nest drives is a shim: Nest only needs one so
 * its lifecycle can run, and here `listen()` and `close()` do
 * nothing.
 *
 * Static assets and WebSockets are not portable across fetch
 * hosts, so they are supplied by the caller through the
 * options. A host that has neither can leave them out; asking
 * for one throws rather than silently answering nothing.
 */

/**
 * A static-asset middleware the host provides — for example
 * built from `hono/cloudflare-workers` over the `ASSETS`
 * binding.
 */
type StaticHandler = (
  options: StaticOptions,
) => MiddlewareHandler<NestEnv>;

/** The host's websocket helper, when it has one. */
type WebSocketFactory = (app: NestHono) => WebSocketSupport;

/**
 * The upgrade helper a fetch host publishes for its own
 * websocket support — `upgradeWebSocket` from
 * `hono/cloudflare-workers`, `@hono/cloudflare-workers`, or the
 * Deno and Bun fetch adapters. It is what a deployment has in
 * hand; this transport's option wants the factory above, and
 * {@link webSocketFromHost} is the bridge.
 */
type HostWebSocket = WebSocketSupport['upgradeWebSocket'];

interface FetchServerOptions {
  /** The host's static-asset middleware, when it has one. */
  readonly serveStatic?: StaticHandler;
  /** The host's websocket helper, when it has one. */
  readonly upgradeWebSocket?: WebSocketFactory;
}

/**
 * Nothing for a fetch host to release: it owns its own request
 * loop, and there is no server the adapter holds an upgrade
 * listener on.
 */
function noDisposer(): void {
  // A fetch host is handed requests; it does not hold a server.
}

/**
 * Builds the `upgradeWebSocket` option from the host's own
 * upgrade helper.
 *
 * The option asks for a factory carrying an `install`, because
 * a runtime with a server attaches an upgrade listener through
 * one — `@hono/node-ws` on Node, `hono/bun` on Bun. A fetch
 * host has no such server, so the `install` it would write can
 * only ever do nothing. That is this transport's knowledge
 * rather than the deployment's, and this is where it is said
 * once:
 *
 * ```ts
 * import { upgradeWebSocket } from 'hono/cloudflare-workers';
 *
 * new ServerAdapter({
 *   transport: fetchServer({
 *     upgradeWebSocket: webSocketFromHost(
 *       upgradeWebSocket,
 *     ),
 *   }),
 * });
 * ```
 *
 * The helper is assignable to this option's inner type as it
 * comes from Hono, with no cast.
 */
function webSocketFromHost(
  upgradeWebSocket: HostWebSocket,
): WebSocketFactory {
  return () => ({
    install: () => noDisposer,
    upgradeWebSocket,
  });
}

/**
 * The server Nest drives on a fetch host: a shim whose
 * lifecycle calls do nothing, because the host owns the request
 * loop.
 */
class FetchServer extends EventEmitter implements Server {
  /**
   * A fetch host is always listening — it hands the adapter a
   * request rather than the other way around — so there is
   * nothing to start.
   */
  public listen(): void {
    // Nothing to start.
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

/** The trusted request metadata a fetch host can supply. */
interface FetchHandlerOptions {
  /**
   * Resolves a trusted address supplied by the host. Only read
   * a header here if the host guarantees clients cannot forge
   * it; this address is used even with `trustProxy: false`.
   * Without a resolver, the carrier has no address.
   */
  readonly clientAddress?: (
    request: Request,
  ) => string | undefined;
}

/**
 * Wraps a Hono application as the `fetch` a host exports. The
 * request carrier Nest's SSE path reads is synthesized from the
 * request's signal, and its address comes only from the host's
 * explicitly configured resolver.
 */
function fetchHandler(
  app: NestHono,
  options: FetchHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return (request: Request): Promise<Response> => {
    let address: string | undefined = undefined;
    if (options.clientAddress !== undefined) {
      address = options.clientAddress(request);
    }
    const incoming = new RequestCarrier(address);
    request.signal.addEventListener(
      'abort',
      () => {
        incoming.emit('close');
      },
      { once: true },
    );
    return Promise.resolve(app.fetch(request, { incoming }));
  };
}

/**
 * What asked for a capability the fetch transport does not
 * port.
 */
function unsupportedHost(capability: string): never {
  throw new TypeError(
    `The fetch transport does not carry ${capability}; ` +
      `pass it to fetchServer() from the host, or use a ` +
      'platform transport.',
  );
}

/** The fetch transport, for `new ServerAdapter({ transport })`. */
function fetchServer(
  options: FetchServerOptions = {},
): Transport {
  return {
    createServer: (): Server => new FetchServer(),
    createWebSocket:
      options.upgradeWebSocket ??
      ((): never => unsupportedHost('WebSockets')),
    serveStatic:
      options.serveStatic ??
      ((): never => unsupportedHost('static assets')),
  };
}

export { fetchHandler, fetchServer, webSocketFromHost };
export type {
  FetchHandlerOptions,
  FetchServerOptions,
  HostWebSocket as FetchHostWebSocket,
  StaticHandler as FetchStaticHandler,
  WebSocketFactory as FetchWebSocketFactory,
};

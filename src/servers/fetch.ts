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

interface FetchServerOptions {
  /** The host's static-asset middleware, when it has one. */
  readonly serveStatic?: StaticHandler;
  /** The host's websocket helper, when it has one. */
  readonly upgradeWebSocket?: WebSocketFactory;
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

/**
 * The client address a proxy's headers name, when they name
 * one.
 */
function clientAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded !== null) {
    const [first] = forwarded.split(',');
    if (first === undefined) {
      return undefined;
    }
    return first.trim();
  }
  return request.headers.get('cf-connecting-ip') ?? undefined;
}

/**
 * Wraps a Hono application as the `fetch` a host exports. The
 * request carrier Nest's SSE path reads is synthesized from the
 * request's signal, and the client address from the proxy
 * headers the host sets.
 */
function fetchHandler(
  app: NestHono,
): (request: Request) => Promise<Response> {
  return (request: Request): Promise<Response> => {
    const incoming = new RequestCarrier(clientAddress(request));
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

export { fetchHandler, fetchServer };
export type {
  FetchServerOptions,
  StaticHandler as FetchStaticHandler,
  WebSocketFactory as FetchWebSocketFactory,
};

import { EventEmitter } from 'node:events';

import {
  RequestCarrier,
  remoteAddressOf,
} from '../core/bindings.ts';
import type { NestHono } from '../core/context.ts';
import type { Server } from '../core/server.ts';
import type {
  ServerOptions,
  Transport,
  WebSocketSupport,
} from '../core/transport.ts';

import {
  bunServeStatic,
  MAX_BODY_SIZE,
  tlsOf,
} from './bun-runtime.ts';
import type {
  BunAddress,
  BunRuntime,
  HttpsOptions,
  ServeOptions,
} from './bun-runtime.ts';

/**
 * The Bun transport: the runtime-specific half of the adapter,
 * reached through the `./bun-server` subpath. It builds the
 * server Nest drives over `Bun.serve`, synthesizes the request
 * bindings from what Bun reports, serves files with `Bun.file`,
 * and upgrades WebSockets with `hono/bun` — which it loads only
 * where the Bun global exists, so the same module still loads
 * on Node. What Bun's server and TLS options look like is in
 * `bun-runtime.ts`.
 */

/** The `hono/bun` module, by its own declaration. */
// oxlint-disable-next-line typescript/consistent-type-imports -- the module's own declaration; a named type import would have to be kept in step by hand and would put a static `hono/bun` specifier in a module that cannot import it statically on Node.
type HonoBun = typeof import('hono/bun');

/**
 * Resolves `hono/bun` where the Bun global exists, and nothing
 * on Node. `hono/bun` re-exports `ssg.js`, whose top level
 * reads `Bun`, so a static import throws on Node before any
 * option is read and leaves the adapter impossible to import
 * there at all. On Node the value is `undefined`, and the
 * transport then carries no WebSocket helper, which is what
 * lets the `ws` package fall back to `@hono/node-ws`.
 *
 * Only the missing global skips the import: where Bun is
 * present, a failure to load the module still throws, so a
 * broken `hono/bun` is never mistaken for a runtime that cannot
 * WebSocket.
 */
async function importHonoBun(): Promise<HonoBun | undefined> {
  if (typeof Bun === 'undefined') {
    return undefined;
  }
  const bun = await import('hono/bun');
  return bun;
}

/** The `hono/bun` module, loaded where the runtime provides it. */
// oxlint-disable-next-line node/no-top-level-await -- the module has to be resolved before anything reads the transport, and this package publishes ESM only: `require(esm)` is not a loading path it supports.
const honoBun = await importHonoBun();

/** The callback Nest passes alongside the port. */
type ListenCallback = (error?: unknown) => void;

/** Says a websocket handler is already installed on the server. */
function noDisposer(): void {
  // Nothing to release: Bun takes the handler at construction.
}

/**
 * The server Nest drives over `Bun.serve`.
 * `AbstractHttpAdapter` hands the core a value it treats as a
 * Node `net.Server`: `app.listen()` subscribes to its `'error'`
 * event and reads `address()`, `app.close()` closes it, and the
 * WebSocket adapter attaches to it. Bun's `Server` has none of
 * that shape — it exposes `stop()` and `port` instead — so this
 * shim carries the Node-shaped lifecycle and starts the real
 * server on `listen()`.
 *
 * Starting on `listen()` rather than when the shim is built is
 * what lets the WebSocket handler be handed over before the
 * server exists: `Bun.serve` takes its `websocket` handler at
 * construction, and Nest connects the gateways during
 * `app.init()`, before `app.listen()`.
 */
class BunServer extends EventEmitter implements Server {
  private readonly app: NestHono;
  private server: BunRuntime | undefined;
  private websocket: unknown;
  private readonly tls: unknown;
  private unix: string | undefined;

  public constructor(
    app: NestHono,
    certificate?: HttpsOptions,
  ) {
    super();
    this.app = app;
    this.tls = tlsOf(certificate);
  }

  /**
   * Hands over the handler Bun upgrades WebSocket requests
   * with.
   */
  public useWebSocket(handler: unknown): void {
    this.websocket = handler;
  }

  /**
   * Starts the server. Bun binds synchronously, so the callback
   * Nest passes is answered once the server is up, and a
   * failure to bind is reported both on `'error'` and to the
   * callback, which is where `app.listen()` reads it.
   */
  public listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    const hostname = this.hostnameOf(hostnameOrCallback);
    const done = this.callbackOf(hostnameOrCallback, callback);
    try {
      this.start(port, hostname);
      if (done !== undefined) {
        done();
      }
    } catch (error) {
      this.emit('error', error);
      if (done !== undefined) {
        done(error);
      }
    }
  }

  /** The address Nest formats, or the path a unix socket is on. */
  public address(): BunAddress | string | undefined {
    if (this.unix !== undefined) {
      return this.unix;
    }
    const { server } = this;
    if (server === undefined) {
      return undefined;
    }
    const address = server.hostname ?? '0.0.0.0';
    let family = 'IPv4';
    if (address.includes(':')) {
      family = 'IPv6';
    }
    return { address, family, port: server.port ?? 0 };
  }

  /**
   * Stops the server and settles once the connections it was
   * holding are done. A server that never started has nothing
   * to stop, which is not an error.
   */
  public async close(
    closeActiveConnections = false,
  ): Promise<void> {
    const { server } = this;
    this.server = undefined;
    if (server === undefined) {
      return;
    }
    await server.stop(closeActiveConnections);
  }

  /**
   * The fetch handler `Bun.serve` runs: it builds the bindings
   * Nest's SSE path reads — a synthesized request carrier whose
   * socket reports the client address Bun knows and goes away
   * when the request does — and hands them to Hono with the
   * native server, which is how `hono/bun` upgrades a
   * WebSocket.
   */
  private fetch(
    request: Request,
    server: BunRuntime,
  ): Response | Promise<Response> {
    const incoming = new RequestCarrier(
      remoteAddressOf(server.requestIP(request)),
    );
    request.signal.addEventListener(
      'abort',
      () => {
        incoming.emit('close');
      },
      { once: true },
    );
    return this.app.fetch(request, { incoming, server });
  }

  private start(
    port: string | number,
    hostname: string | undefined,
  ): void {
    const options = this.optionsFor(port, hostname);
    this.server = Bun.serve(
      options as unknown as ServeOptions,
    ) as unknown as BunRuntime;
  }

  /**
   * The hostname Nest's listen arguments name, when they name
   * one.
   */
  private hostnameOf(
    hostnameOrCallback: string | (() => void) | undefined,
  ): string | undefined {
    if (typeof hostnameOrCallback === 'string') {
      return hostnameOrCallback;
    }
    return undefined;
  }

  /**
   * The callback Nest's listen arguments name, when they name
   * one.
   */
  private callbackOf(
    hostnameOrCallback: string | (() => void) | undefined,
    callback: (() => void) | undefined,
  ): ListenCallback | undefined {
    if (typeof hostnameOrCallback === 'function') {
      return hostnameOrCallback;
    }
    return callback;
  }

  /** The options every server is given, whatever its transport. */
  private baseOptions(): Record<string, unknown> {
    const options: Record<string, unknown> = {
      fetch: this.fetch.bind(this),
      maxRequestBodySize: MAX_BODY_SIZE,
    };
    if (this.websocket !== undefined) {
      options.websocket = this.websocket;
    }
    if (this.tls !== undefined) {
      options.tls = this.tls;
    }
    return options;
  }

  /** The options `Bun.serve` is started with. */
  private optionsFor(
    port: string | number,
    hostname: string | undefined,
  ): Record<string, unknown> {
    const options = this.baseOptions();
    if (typeof port === 'string') {
      options.unix = port;
      this.unix = port;
      return options;
    }
    options.port = port;
    if (hostname !== undefined) {
      options.hostname = hostname;
    }
    this.unix = undefined;
    return options;
  }
}

/**
 * The `hono/bun` websocket helper, where the module loaded: on
 * Node there is none, and `bunServer()` exposes no helper,
 * which is what lets the `ws` package fall back to
 * `@hono/node-ws`.
 */
const bunWebSocket =
  honoBun &&
  ((app: NestHono): WebSocketSupport => {
    // `hono/bun` reads the native server from `context.env.server`,
    // which this transport's bindings always carry.
    void app;
    return {
      install: (server: Server): (() => void) => {
        if (server instanceof BunServer) {
          // oxlint-disable-next-line typescript/no-deprecated -- `hono/bun` re-exports it; moving to the `@hono/bun` package it points at is a follow-up, and the bytes are already in this entrypoint.
          server.useWebSocket(honoBun.websocket);
        }
        return noDisposer;
      },
      // oxlint-disable-next-line typescript/no-deprecated -- the same `hono/bun` re-export as above.
      upgradeWebSocket: honoBun.upgradeWebSocket,
    };
  });

/** Builds the server Nest drives over `Bun.serve`. */
function createBunServer(
  app: NestHono,
  options: ServerOptions,
): Server {
  return new BunServer(app, options.httpsOptions);
}

/** The Bun transport, for `new ServerAdapter({ transport })`. */
function bunServer(): Transport {
  return {
    createServer: createBunServer,
    createWebSocket: bunWebSocket,
    serveStatic: bunServeStatic,
  };
}

export { toBunTls } from './bun-runtime.ts';
export { BunServer, bunServer };

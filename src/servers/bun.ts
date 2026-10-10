import { EventEmitter } from 'node:events';
import { stat } from 'node:fs/promises';
import nodePath from 'node:path';

import type { NestApplicationOptions } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import { serveStatic as baseServeStatic } from 'hono/serve-static';
import { upgradeWebSocket, websocket } from 'hono/bun';

import {
  RequestCarrier,
  remoteAddressOf,
} from '../core/bindings.ts';
import type { SocketAddress } from '../core/bindings.ts';
import type { NestEnv, NestHono } from '../core/context.ts';
import type { Server } from '../core/server.ts';
import type {
  ServerOptions,
  StaticOptions,
  Transport,
  WebSocketSupport,
} from '../core/transport.ts';

/**
 * The Bun transport: the runtime-specific half of the adapter,
 * reached through the `./bun-server` subpath. It builds the
 * server Nest drives over `Bun.serve`, synthesizes the request
 * bindings from what Bun reports, serves files with `Bun.file`,
 * and upgrades WebSockets with `hono/bun`.
 */

/** The address Nest formats from a listening server. */
interface BunAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

/**
 * The part of Bun's native server this transport drives. Typed
 * structurally rather than taken from Bun's own declaration, so
 * the module stays free of that surface.
 */
interface BunRuntime {
  readonly hostname: string | undefined;
  readonly port: number | undefined;
  readonly requestIP: (
    request: Request,
  ) => SocketAddress | null;
  readonly stop: (
    closeActiveConnections?: boolean,
  ) => Promise<void>;
}

/** What Nest allows as TLS options. */
type HttpsOptions = NonNullable<
  NestApplicationOptions['httpsOptions']
>;

/** The options `Bun.serve` takes. */
type ServeOptions = Parameters<typeof Bun.serve>[0];

/** The callback Nest passes alongside the port. */
type ListenCallback = (error?: unknown) => void;

/**
 * The largest body Bun's server itself accepts. The adapter's
 * own limit is what answers a body that is too large, and that
 * limit can be turned off, so Bun's default cap is raised out
 * of the way: otherwise a deployment that removed its limit
 * would still be stopped at Bun's 128 MiB default.
 */
const MAX_BODY_SIZE = Number.MAX_SAFE_INTEGER;

/**
 * The Node TLS options Bun understands, by the name each keeps
 * on Bun's own options object. The ones with no meaning on
 * Bun's server are left out rather than translated into
 * something that would say less than they do.
 */
const TLS_FIELDS = [
  'key',
  'cert',
  'ca',
  'passphrase',
  'ciphers',
  'secureOptions',
  'requestCert',
  'rejectUnauthorized',
] as const;

/** Maps the Node TLS options a deployment named onto Bun's. */
function toBunTls(
  certificate: HttpsOptions,
): Record<string, unknown> {
  const tls: Record<string, unknown> = {};
  for (const name of TLS_FIELDS) {
    const value = certificate[name] as unknown;
    if (value !== undefined) {
      tls[name] = value;
    }
  }
  return tls;
}

/** The TLS options Bun is started with, when there are any. */
function tlsOf(
  certificate: HttpsOptions | undefined,
): Record<string, unknown> | undefined {
  if (certificate === undefined) {
    return undefined;
  }
  return toBunTls(certificate);
}

/** What the Hono middleware reads as "no file here". */
// oxlint-disable-next-line unicorn/no-null -- the middleware signals "not found" with a null answer.
const NOT_FOUND = null;

/** The file a path names, or nothing when there is none. */
async function readContent(
  target: string,
): Promise<Response | null> {
  const file = Bun.file(target);
  const found = await file.exists();
  if (!found) {
    return NOT_FOUND;
  }
  // A `BunFile` is a `Blob`, which is what the Hono middleware
  // writes as the body; it is cast because the option is typed
  // against the Web `Data` union.
  return file as unknown as Response;
}

/**
 * The content of the file a path names, with the index file
 * answered for a directory. A path that cannot be read is
 * nothing, which is what lets the route behind answer.
 */
async function contentOf(
  filePath: string,
  index: string,
): Promise<Response | null> {
  try {
    const stats = await stat(filePath);
    if (!stats.isDirectory()) {
      return await readContent(filePath);
    }
    return await readContent(nodePath.join(filePath, index));
  } catch {
    return NOT_FOUND;
  }
}

/** The middleware that serves one directory with `Bun.file`. */
function bunServeStatic(
  options: StaticOptions,
): MiddlewareHandler<NestEnv> {
  const config: Record<string, unknown> = {
    getContent: (filePath: string) =>
      contentOf(filePath, options.index),
    isDir: (): boolean => false,
    join: (...parts: string[]) => nodePath.join(...parts),
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined) {
    config.rewriteRequestPath = options.rewriteRequestPath;
  }
  return baseServeStatic<NestEnv>(
    config as unknown as Parameters<
      typeof baseServeStatic<NestEnv>
    >[0],
  );
}

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

/** The `hono/bun` websocket helper, handed to `Bun.serve`. */
function bunWebSocket(app: NestHono): WebSocketSupport {
  // `hono/bun` reads the native server from `context.env.server`,
  // which this transport's bindings always carry.
  void app;
  return {
    install: (server: Server): (() => void) => {
      if (server instanceof BunServer) {
        // oxlint-disable-next-line typescript/no-deprecated -- `hono/bun` re-exports it; moving to the `@hono/bun` package it points at is a follow-up, and the bytes are already in this entrypoint.
        server.useWebSocket(websocket);
      }
      return noDisposer;
    },
    upgradeWebSocket:
      // oxlint-disable-next-line typescript/no-deprecated -- the same `hono/bun` re-export as above.
      upgradeWebSocket as unknown as WebSocketSupport['upgradeWebSocket'],
  };
}

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

export { BunServer, bunServer, toBunTls };

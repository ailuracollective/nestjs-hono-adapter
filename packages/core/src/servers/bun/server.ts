import { EventEmitter } from 'node:events';
import { tlsOf } from '#adapter/servers/bun-runtime';
import type { NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type {
  BunAddress,
  BunRuntime,
  HttpsOptions,
  ServeOptions,
} from '#adapter/servers/bun-runtime';
import { addressOf, closeServer } from './lifecycle.ts';
import { callbackOf, hostnameOf } from './listen-args.ts';
import { fetchOf } from './request.ts';
import { applyAddress, baseOptions } from './serve-options.ts';

/**
 * What a capability installs on the Bun server beside the
 * application.
 */
interface NativeHandler {
  /**
   * Answers a request the capability owns, or none to let the
   * application answer it.
   */
  readonly handleRequest: (
    request: Request,
    server: BunRuntime,
  ) => Response | Promise<Response> | undefined;
  /** The seconds Bun keeps an idle connection. */
  readonly idleTimeout: number;
  /** The handler Bun upgrades WebSocket requests with. */
  readonly websocket: unknown;
}

/** The server Nest drives over `Bun.serve`. */
class BunServer extends EventEmitter implements Server {
  /** The Hono application the server answers with. */
  private readonly app: NestHono;
  /** Bun's own server, once it is started. */
  private server: BunRuntime | undefined;
  /** The handler a capability installed, where one did. */
  private native: NativeHandler | undefined;
  /** The handler Bun upgrades WebSocket requests with. */
  private websocket: unknown;
  /** The TLS options the server is started with. */
  private readonly tls: unknown;
  /** The path a unix socket is served on, when one is. */
  private unix: string | undefined;

  /** Builds the server on the application it answers with. */
  public constructor(
    app: NestHono,
    certificate?: HttpsOptions,
  ) {
    super();
    this.app = app;
    this.tls = tlsOf(certificate);
  }

  /** Stores the websocket handler Bun upgrades requests with. */
  public useWebSocket(handler: unknown): void {
    this.websocket = handler;
  }

  /**
   * Installs a capability's handler beside the application,
   * before the server starts.
   */
  public useNativeHandler(handler: NativeHandler): void {
    this.native = handler;
  }

  /** Starts the server and answers the callback Nest passed. */
  public listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    const hostname = hostnameOf(hostnameOrCallback);
    const done = callbackOf(hostnameOrCallback, callback);
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
    return addressOf(this.unix, this.server);
  }

  /** Stops the server and settles when it has. */
  public async close(
    closeActiveConnections = false,
  ): Promise<void> {
    const { server } = this;
    this.server = undefined;
    await closeServer(server, closeActiveConnections);
  }

  /** Starts Bun's server on the options built for it. */
  private start(
    port: string | number,
    hostname: string | undefined,
  ): void {
    const { native } = this;
    const options = baseOptions(
      (request, server) =>
        native === undefined
          ? fetchOf(this.app, request, server)
          : (native.handleRequest(request, server) ??
            fetchOf(this.app, request, server)),
      native === undefined ? this.websocket : native.websocket,
      this.tls,
    );
    if (native !== undefined) {
      options.idleTimeout = native.idleTimeout;
    }
    this.unix = applyAddress(options, port, hostname);
    this.server = Bun.serve(
      options as unknown as ServeOptions,
    ) as unknown as BunRuntime;
  }
}

export { BunServer };
export type { NativeHandler };
export { noDisposer } from './listen-args.ts';
export type { ListenCallback } from './listen-args.ts';

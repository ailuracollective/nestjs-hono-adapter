import { createServer as createHttpsServer } from 'node:https';
import { promisify } from 'node:util';

import { createAdaptorServer } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import type { NestApplicationOptions } from '@nestjs/common';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { closingBridge } from './closing.ts';
import type { NestHono, NodeEnv } from './context.ts';
import { corsBridge } from './cors-middleware.ts';
import type { CorsOptions } from './cors-middleware.ts';
import { RouteAdapter } from './route-adapter.ts';

/**
 * The shutdown options, which Nest 11 does not declare as part
 * of the application options: `return503OnClosing` was added in
 * Nest 12, so it is read through a type that names it and stays
 * optional for both.
 */
type ClosingOptions = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

/** The size a request body may reach before it is refused. */
const DEFAULT_BODY_LIMIT = 1_048_576;

/** The security headers Hono is configured with. */
type SecureHeadersOptions = NonNullable<
  Parameters<typeof secureHeaders>[0]
>;

/** What `@hono/node-server` accepts to build the Node server. */
type AdaptorOptions = Parameters<typeof createAdaptorServer>[0];

/** The transport options the lifecycle reads. */
interface TransportOptions {
  /** Largest body accepted, in bytes; `0` accepts any size. */
  readonly bodyLimit?: number;
  /** Whether `req.rawBody` keeps the bytes of every body. */
  readonly rawBody?: boolean;
  /** The security headers to send, or `false` to send none. */
  readonly secureHeaders?: boolean | SecureHeadersOptions;
  /** Whether `X-Forwarded-*` headers come from a proxy. */
  readonly trustProxy?: boolean;
}

/** Destroys the connections a server is still holding open. */
function closeConnections(server: ServerType): void {
  if ('closeAllConnections' in server) {
    server.closeAllConnections();
  }
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

/**
 * Runs Nest on Hono: this owns the Hono application, the
 * middleware every request passes through, and the Node server
 * the fetch handler is served on. The routes Nest registers and
 * the answers it writes are the business of the class below.
 *
 * The transport options Nest passes in are honoured: requests
 * are served over TLS when `httpsOptions` is set, connections
 * are dropped on shutdown when `forceCloseConnections` is set,
 * and a request that arrives while the application is closing
 * is answered with `503` when `return503OnClosing` is set.
 */
abstract class HonoLifecycle extends RouteAdapter {
  protected readonly hono: NestHono;
  protected readonly trustProxy: boolean;
  protected bodyLimit: number;
  protected bodyParsingEnabled = false;
  protected rawBodyEnabled: boolean;
  protected corsOptions: CorsOptions | undefined;
  private closing = false;
  private forceCloseConnections = false;
  private return503OnClosing = false;

  protected constructor(options: TransportOptions = {}) {
    const hono = new Hono<NodeEnv>();
    super(hono);
    this.hono = hono;
    this.bodyLimit = options.bodyLimit ?? DEFAULT_BODY_LIMIT;
    this.rawBodyEnabled = options.rawBody ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.installSecurityHeaders(options.secureHeaders ?? true);
    // CORS runs first, so a 503 sent while closing is readable.
    hono.use(
      '*',
      corsBridge(() => this.corsOptions),
    );
    hono.use(
      '*',
      closingBridge(
        () => this.return503OnClosing && this.closing,
      ),
    );
  }

  /**
   * Identifier ecosystem packages branch on. It is the only
   * value Nest itself does not consume.
   */
  public override getType(): string {
    return 'hono';
  }

  /**
   * The Hono application behind the adapter, for the middleware
   * and routes only Hono knows how to express. Registering on
   * it before the application listens puts them ahead of Nest's
   * routes, after the headers and CORS this adapter installs.
   */
  public getHono(): NestHono {
    return this.hono;
  }

  /**
   * Says that a Hono router scores its routes rather than
   * matching them in the order they were added, so two routes
   * cannot shadow each other and Nest does not have to sort
   * them.
   */
  public isRouteOrderSensitive(): boolean {
    return false;
  }

  /** Reads the shutdown options Nest hands the adapter. */
  private readShutdownOptions(
    options: NestApplicationOptions,
  ): void {
    const closing: ClosingOptions = options;
    this.forceCloseConnections =
      options.forceCloseConnections ?? false;
    this.return503OnClosing =
      closing.return503OnClosing ?? false;
  }

  /**
   * Creates the Node server Hono's fetch handler is served
   * through. Hono has no listener of its own, so `listen()` and
   * `close()` operate on the value built here.
   */
  public override initHttpServer(
    options: NestApplicationOptions,
  ): void {
    this.readShutdownOptions(options);
    if (options.rawBody === true) {
      this.rawBodyEnabled = true;
    }
    const certificate = options.httpsOptions;
    if (certificate === undefined) {
      this.setHttpServer(
        createAdaptorServer({
          fetch: this.hono.fetch,
          overrideGlobalObjects: false,
        }),
      );
      return;
    }
    const adaptorOptions: AdaptorOptions = {
      createServer: createHttpsServer,
      fetch: this.hono.fetch,
      overrideGlobalObjects: false,
      serverOptions: certificate,
    };
    this.setHttpServer(createAdaptorServer(adaptorOptions));
  }

  public override listen(
    port: string | number,
    callback?: () => void,
  ): void;
  public override listen(
    port: string | number,
    hostname: string,
    callback?: () => void,
  ): void;
  public override listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    if (typeof port === 'string') {
      this.httpServer.listen(port, callback);
      return;
    }
    if (typeof hostnameOrCallback === 'function') {
      this.httpServer.listen(port, hostnameOrCallback);
      return;
    }
    if (typeof hostnameOrCallback === 'string') {
      this.httpServer.listen(
        port,
        hostnameOrCallback,
        callback,
      );
      return;
    }
    this.httpServer.listen(port, callback);
  }

  /**
   * Stops the server and, when the application asked for it,
   * the connections it is still holding open. A server that
   * never started listening has nothing to close, so the error
   * it reports then is not a failure worth propagating.
   */
  public override async close(): Promise<void> {
    this.closing = true;
    const { httpServer } = this;
    if (this.forceCloseConnections) {
      closeConnections(httpServer);
    }
    try {
      await promisify((done: () => void) => {
        httpServer.close(done);
      })();
    } catch (error) {
      if (!isNotRunning(error)) {
        throw error;
      }
    }
  }

  /** Records that the payload's bytes have to be kept. */
  protected keepRawBody(rawBody?: boolean): void {
    if (rawBody === true) {
      this.rawBodyEnabled = true;
    }
  }

  /**
   * Installs the security headers Hono sends with every answer,
   * unless the deployment turned them off. They come from Hono
   * rather than from Helmet, which is Express middleware: the
   * families of headers are the same.
   */
  private installSecurityHeaders(
    headers: boolean | SecureHeadersOptions,
  ): void {
    if (headers === true) {
      this.hono.use('*', secureHeaders());
      return;
    }
    if (headers !== false) {
      this.hono.use('*', secureHeaders(headers));
    }
  }
}

export { HonoLifecycle };
export type { TransportOptions };

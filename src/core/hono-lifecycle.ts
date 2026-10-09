import { createServer as createHttpsServer } from 'node:https';
import { promisify } from 'node:util';

import { createAdaptorServer } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import type { NestApplicationOptions } from '@nestjs/common';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import type { NestHono, NodeEnv } from './context.ts';
import type { TrustProxy } from './request.ts';
import { corsBridge } from '../features/cors-middleware.ts';
import type { CorsOptions } from '../features/cors-middleware.ts';
import { guardBridge } from '../features/guard-bridge.ts';
import { RouteAdapter } from './route-adapter.ts';
import { mountSse } from '../features/sse.ts';

/**
 * `return503OnClosing` arrived in Nest 12, read through a type
 * optional on both.
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
  /**
   * Whether `@hono/node-server` may replace the global
   * `Request` and `Response` with its lighter classes, worth
   * roughly a third of the CPU an answer costs. A platform that
   * refuses a foreign answer at its own boundary turns it off.
   */
  readonly overrideGlobalObjects?: boolean;
  /** Whether `req.rawBody` keeps the bytes of every body. */
  readonly rawBody?: boolean;
  /** The security headers to send, or `false` to send none. */
  readonly secureHeaders?: boolean | SecureHeadersOptions;
  /** How much of a proxy's word the deployment believes. */
  readonly trustProxy?: TrustProxy;
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
 * Runs Nest on Hono: owns the Hono application, the middleware
 * every request crosses, and the Node server behind the fetch
 * handler. The routes Nest registers are `RouteAdapter`'s.
 */
// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
abstract class HonoLifecycle extends RouteAdapter {
  protected readonly hono: NestHono;
  /**
   * The surface an event stream is written into, named here to
   * cross the seam.
   */
  protected readonly interceptor = mountSse;
  protected readonly trustProxy: TrustProxy;
  protected bodyLimit: number;
  protected overrideGlobalObjects: boolean;
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
    this.overrideGlobalObjects =
      options.overrideGlobalObjects ?? true;
    this.rawBodyEnabled = options.rawBody ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.beforeClose = (): void => {
      this.closing = true;
    };
    this.installSecurityHeaders(options.secureHeaders ?? true);
    this.installGuards(hono);
  }

  /**
   * CORS and the closing refusal are one middleware rather than
   * two: each mount is a step every request pays for, and an
   * application that configured neither should pay for
   * neither.
   */
  private installGuards(hono: NestHono): void {
    const cors = corsBridge(() => this.corsOptions);
    hono.use(
      '*',
      guardBridge({
        closing: () => this.return503OnClosing && this.closing,
        cors,
        corsEnabled: () => this.corsOptions !== undefined,
      }),
    );
  }

  /**
   * The literal, so a consumer's own branch narrows on it
   * without comparing.
   */
  public override getType(): 'hono' {
    return 'hono';
  }

  /**
   * The Hono application, for what only Hono expresses.
   * Registering here before the application listens puts it
   * ahead of Nest's routes and behind the headers and CORS this
   * adapter installs.
   */
  public getHono(): NestHono {
    return this.hono;
  }

  /**
   * A Hono router scores its routes, so two cannot shadow each
   * other.
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
   * through; `listen()` and `close()` work on the value built
   * here. `overrideGlobalObjects` swaps the global `Response`
   * for the lighter class `@hono/node-server` provides, so an
   * answer is written in one `end()` instead of a chunk at a
   * time — its prototype is the native one, so `instanceof
   * Response` still passes. A platform that checks the type of
   * an answer at its own boundary (`httpServerHandler` of
   * `cloudflare:node` does) asks for the platform's own classes
   * instead.
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
          overrideGlobalObjects: this.overrideGlobalObjects,
        }),
      );
      return;
    }
    const adaptorOptions: AdaptorOptions = {
      createServer: createHttpsServer,
      fetch: this.hono.fetch,
      overrideGlobalObjects: this.overrideGlobalObjects,
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
   * Stops the server and, when asked, the connections it holds
   * open. A server that never listened has nothing to close, so
   * that error is not propagated.
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
   * Installs the security headers, unless the deployment turned
   * them off. They come from Hono rather than Helmet, which is
   * Express middleware: the families of headers are the same.
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

/**
 * The member this class declares next to the base rather than
 * in it: Nest 12 declares `beforeClose()` and Nest 11 does not,
 * and a package compiled against `>=11 <13` cannot express
 * "only where it exists" — `override` fails on one install and
 * dropping it fails on the other. A merged declaration is the
 * one form both accept, and it only accepts a property, which
 * is why `beforeClose` is installed in the constructor.
 * `test/types/route-adapter-compat.ts` holds it to whichever
 * base is installed, since nothing in the class body checks
 * it.
 */
interface HonoLifecycle {
  /**
   * Marks the application as closing when Nest starts its
   * shutdown rather than when the server closes, so a
   * deployment that asked for `return503OnClosing` is refused
   * through the destroy and before-shutdown hooks too.
   */
  beforeClose: () => void;

  /**
   * The Hono application, through the accessor `HttpServer`
   * documents. Nest declares that one untyped, so the default
   * is narrowed rather than the return type: the escape hatch
   * `getInstance<Other>()` still answers, and a caller reaching
   * past the default is saying so.
   */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the base declares this parameter; an accessor whose caller names a type cannot be narrowed to one return type.
  getInstance: <TInstance = NestHono>() => TInstance;
}

export { HonoLifecycle };
export type { TransportOptions };

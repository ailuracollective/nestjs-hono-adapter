import type { NestApplicationOptions } from '@nestjs/common';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import type { Server as NativeServer } from 'node:http';

import type { NestEnv, NestHono } from './context.ts';
import type { Server } from './server.ts';
import type { Transport } from './transport.ts';
import type { TrustProxy } from './request.ts';
import { corsBridge } from '../features/cors-middleware.ts';
import type { CorsConfig } from '../features/cors-middleware.ts';
import {
  guardBridge,
  instrumentationBridge,
} from '../features/guard-bridge.ts';
import type {
  OnRequestHook,
  OnResponseHook,
} from '../features/guard-bridge.ts';
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

/** The transport options the lifecycle reads. */
interface TransportOptions {
  /** Largest body accepted, in bytes; `0` accepts any size. */
  readonly bodyLimit?: number;
  /** Whether `req.rawBody` keeps the bytes of every body. */
  readonly rawBody?: boolean;
  /** The security headers to send, or `false` to send none. */
  readonly secureHeaders?: boolean | SecureHeadersOptions;
  /**
   * The runtime-specific half of the adapter: how the server is
   * built, files are served and websockets are upgraded.
   */
  readonly transport: Transport;
  /** How much of a proxy's word the deployment believes. */
  readonly trustProxy?: TrustProxy;
}

/**
 * The settings that name something this adapter does.
 *
 * Only these are honoured. Express carries a settings bag an
 * application can write anything into; here a setting either
 * reaches behaviour or it is an error, because a value stored
 * and then ignored is worse than one refused -- the same reason
 * `inject()` refuses the options it cannot carry.
 *
 * They live in this module because it already owns the settings
 * state the refusals point at -- the `trustProxy` above is what
 * the reason for that name names -- and because the composition
 * root reaches this module already, while its dependency budget
 * cannot take a new one. `views.ts` is at its line ceiling, so
 * the block cannot sit beside the `view engine` name it lists.
 */
const HONOURED = new Set(['view engine', 'views']);

/**
 * Why a name outside `HONOURED` is refused.
 *
 * The reason is written per name where the name is one an
 * application migrating from Express is likely to set, so the
 * error says what to do instead.
 */
const REFUSED: Readonly<Record<string, string>> = {
  env: 'it has no behaviour in this adapter',
  etag: 'it has no behaviour in this adapter',
  'query parser': 'it has no behaviour in this adapter',
  'trust proxy':
    'the transport reads it when the adapter is constructed, so it is set through the adapter options',
  'x-powered-by': 'it has no behaviour in this adapter',
};

/** Answers whether a setting reaches behaviour here. */
function settable(name: string): boolean {
  return HONOURED.has(name);
}

/** Throws for a setting this adapter has nothing behind. */
function refuse(name: string, why?: string): never {
  const reason =
    why ??
    REFUSED[name] ??
    'it has no behaviour in this adapter';
  throw new Error(
    `set() cannot honour the "${name}" setting: ${reason}.`,
  );
}

/**
 * Runs Nest on Hono: owns the Hono application, the middleware
 * every request crosses, and the server the injected transport
 * builds. The routes Nest registers are `RouteAdapter`'s.
 */
// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
abstract class HonoLifecycle extends RouteAdapter {
  protected readonly hono: NestHono;
  /**
   * The surface an event stream is written into, named here to
   * cross the seam.
   */
  protected readonly interceptor = mountSse;
  /** The runtime-specific half of the adapter. */
  protected readonly transport: Transport;
  protected readonly trustProxy: TrustProxy;
  protected bodyLimit: number;
  protected bodyParsingEnabled = false;
  protected rawBodyEnabled: boolean;
  protected corsOptions: CorsConfig | undefined;
  /** The hook the instrumentation registered for a request. */
  private onRequestHook: OnRequestHook | undefined;
  /** The hook the instrumentation registered for an answer. */
  private onResponseHook: OnResponseHook | undefined;
  private closing = false;
  private forceCloseConnections = false;
  private return503OnClosing = false;

  protected constructor(options: TransportOptions) {
    const hono = new Hono<NestEnv>();
    super(hono);
    this.hono = hono;
    this.transport = options.transport;
    this.bodyLimit = options.bodyLimit ?? DEFAULT_BODY_LIMIT;
    this.rawBodyEnabled = options.rawBody ?? false;
    this.trustProxy = options.trustProxy ?? false;
    this.beforeClose = (): void => {
      this.closing = true;
    };
    this.installSecurityHeaders(options.secureHeaders ?? true);
    this.installGuards(hono);
  }

  /**
   * The steps every request crosses before it reaches a route:
   * the instrumentation hooks, then CORS and the closing
   * refusal — which are one middleware rather than two, because
   * each mount is a step every request pays for and an
   * application that configured neither should pay for
   * neither.
   */
  private installGuards(hono: NestHono): void {
    const cors = corsBridge(
      () => this.corsOptions,
      this.trustProxy,
    );
    hono.use(
      '*',
      instrumentationBridge({
        onRequest: () => this.onRequestHook,
        onResponse: () => this.onResponseHook,
        trustProxy: this.trustProxy,
      }),
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
   * The server Nest drives. It is the port every transport
   * implements — and, on the default (Node) transport, Node's
   * own `http.Server`, which is the object this method answered
   * before the transports split. The intersection is that
   * compatibility face: a `closeAllConnections()` or an
   * `'upgrade'` listener keeps compiling, and on the Node
   * transport keeps working.
   */
  public override getHttpServer(): Server & NativeServer {
    return this.httpServer as Server & NativeServer;
  }

  /**
   * A Hono router scores its routes, so two cannot shadow each
   * other.
   */
  public isRouteOrderSensitive(): boolean {
    return false;
  }

  /**
   * Registers the hook Nest's instrumentation runs at the start
   * of every request. It is handed the request Nest reads, the
   * response the transport writes to, and the `done` it calls
   * to continue: a hook that never calls it holds the request,
   * as it does on Express and Fastify. A failure it throws — or
   * returns as a rejected promise — is thrown onto the path the
   * exception layer already owns.
   */
  public override setOnRequestHook(hook: OnRequestHook): void {
    this.onRequestHook = hook;
  }

  /**
   * Registers the hook Nest's instrumentation runs once the
   * response exists. The answer is already decided by then, so
   * a failure it raises is logged rather than answered: letting
   * it escape would replace a good answer with the error one.
   */
  public override setOnResponseHook(
    hook: OnResponseHook,
  ): void {
    this.onResponseHook = hook;
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
   * Builds the server the injected transport serves the Hono
   * application through; `listen()` and `close()` work on the
   * value built here. The transport gets the certificate a
   * deployment named, and — where it needs to — defers starting
   * the server so a WebSocket handler can be handed over
   * first.
   */
  public override initHttpServer(
    options: NestApplicationOptions,
  ): void {
    this.readShutdownOptions(options);
    if (options.rawBody === true) {
      this.rawBodyEnabled = true;
    }
    this.setHttpServer(
      this.transport.createServer(this.hono, {
        httpsOptions: options.httpsOptions,
      }),
    );
  }

  /** The runtime-specific half of the adapter. */
  public getTransport(): Transport {
    return this.transport;
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
    if (typeof hostnameOrCallback === 'string') {
      this.httpServer.listen(
        port,
        hostnameOrCallback,
        callback,
      );
      return;
    }
    this.httpServer.listen(port, hostnameOrCallback);
  }

  /**
   * Stops the server and, when asked, the connections it holds
   * open. A server that never listened has nothing to close.
   */
  public override async close(): Promise<void> {
    this.closing = true;
    await this.httpServer.close(this.forceCloseConnections);
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

export { HonoLifecycle, refuse, settable };
export type { TransportOptions };

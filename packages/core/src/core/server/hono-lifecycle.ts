import type { NestApplicationOptions } from '@nestjs/common';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import type { Server as NativeServer } from 'node:http';

import { installBridges } from '#adapter/compat/index';
import type { NestEnv, NestHono } from '#adapter/core/context';
import type { Server } from '#adapter/core/ports/server';
import type { Transport } from '#adapter/core/ports/transport';
import type { TrustProxy } from '#adapter/core/request/request';
import { corsBridge } from '#adapter/features/cors/index';
import type { CorsConfig } from '#adapter/features/cors/index';
import {
  guardStep,
  instrumentationStep,
} from '#adapter/features/front-steps/index';
import type {
  OnRequestHook,
  OnResponseHook,
} from '#adapter/features/front-steps/index';
import { RouteAdapter } from '#adapter/core/route/route-adapter';
import { mountSse } from '#adapter/features/sse';

/** The application options with `return503OnClosing`. */
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
  /** The runtime-specific half of the adapter. */
  readonly transport: Transport;
  /** How much of a proxy's word the deployment believes. */
  readonly trustProxy?: TrustProxy;
}

/** The settings that name something this adapter does. */
const HONOURED = new Set(['view engine', 'views']);

/** The reason given for each refused setting. */
const REFUSED: Readonly<Record<string, string>> = {
  env: 'it has no behaviour in this adapter',
  etag: 'it has no behaviour in this adapter',
  'query parser': 'it has no behaviour in this adapter',
  'trust proxy':
    'the transport reads it when the adapter is constructed, so it is set through the adapter options',
  'x-powered-by': 'it has no behaviour in this adapter',
};

/** Throws for a setting this adapter has nothing behind. */
const refuse = (name: string, why?: string): never => {
  const reason =
    why ??
    REFUSED[name] ??
    'it has no behaviour in this adapter';
  throw new Error(
    `set() cannot honour the "${name}" setting: ${reason}.`,
  );
};

/** Validates the value a view setting passes to its feature. */
const settingValue = (
  name: string,
  value: unknown,
): string | readonly string[] => {
  if (!HONOURED.has(name)) {
    refuse(name);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (
    name === 'views' &&
    Array.isArray(value) &&
    value.every(
      (directory: unknown) => typeof directory === 'string',
    )
  ) {
    return value;
  }
  if (name === 'views') {
    return refuse(name, 'it takes a string or a string array');
  }
  return refuse(name, 'it takes a string');
};

/** Runs Nest on Hono. */
// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
abstract class HonoLifecycle extends RouteAdapter {
  /** The Hono application. */
  protected readonly hono: NestHono;
  /** The surface an event stream is written into. */
  protected readonly interceptor = mountSse;
  /** The runtime-specific half of the adapter. */
  protected readonly transport: Transport;
  /** How much of a proxy's word the deployment believes. */
  protected readonly trustProxy: TrustProxy;
  /** The largest body accepted, in bytes. */
  protected bodyLimit: number;
  /** Whether body parsing runs. */
  protected bodyParsingEnabled = false;
  /** Whether raw bytes are kept. */
  protected rawBodyEnabled: boolean;
  /** The CORS configuration, when one was set. */
  protected corsOptions: CorsConfig | undefined;
  /** The hook the instrumentation registered for a request. */
  private onRequestHook: OnRequestHook | undefined;
  /** The hook the instrumentation registered for an answer. */
  private onResponseHook: OnResponseHook | undefined;
  /** Whether the application is closing. */
  private closing = false;
  /** Whether close() also closes open connections. */
  private forceCloseConnections = false;
  /** Whether a closing application answers 503. */
  private return503OnClosing = false;

  /**
   * Installs everything the application is built with before a
   * route is registered: the security headers, the request
   * steps, and the compatibility bridges. Kept apart from the
   * constructor so the constructor reads as the field
   * initialisation it is.
   */
  private installPieces(
    hono: NestHono,
    options: TransportOptions,
  ): void {
    this.installSecurityHeaders(options.secureHeaders ?? false);
    this.installGuards(hono);
    installBridges({ hono, transport: this.transport });
  }

  /** Builds the lifecycle with the transport options. */
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
    this.installPieces(hono, options);
  }

  /** Installs the steps every request crosses before a route. */
  private installGuards(hono: NestHono): void {
    const cors = corsBridge(
      () => this.corsOptions,
      this.trustProxy,
    );
    hono.use(
      '*',
      instrumentationStep({
        onRequest: () => this.onRequestHook,
        onResponse: () => this.onResponseHook,
        trustProxy: this.trustProxy,
      }),
      guardStep({
        closing: () => this.return503OnClosing && this.closing,
        cors,
        corsEnabled: () => this.corsOptions !== undefined,
      }),
    );
  }

  /** The platform name, as a literal. */
  public override getType(): 'hono' {
    return 'hono';
  }

  /** The Hono application. */
  public getHono(): NestHono {
    return this.hono;
  }

  /** The server Nest drives. */
  public override getHttpServer(): Server & NativeServer {
    return this.httpServer as Server & NativeServer;
  }

  /** Whether route registration order matters. */
  public isRouteOrderSensitive(): boolean {
    return false;
  }

  /** Registers the hook run at the start of every request. */
  public override setOnRequestHook(hook: OnRequestHook): void {
    this.onRequestHook = hook;
  }

  /** Registers the hook run once the response exists. */
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

  /** Builds the server the transport serves through. */
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

  /** Starts the server on the given port and host. */
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

  /** Stops the server and the connections it holds. */
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

  /** Installs the security headers only when asked for. */
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

/** The class members merged in beside the base class. */
interface HonoLifecycle {
  /** Marks the application as closing when shutdown starts. */
  beforeClose: () => void;

  /** The Hono application, through the documented accessor. */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the base declares this parameter; an accessor whose caller names a type cannot be narrowed to one return type.
  getInstance: <TInstance = NestHono>() => TInstance;
}

export { HonoLifecycle, settingValue };
export type { TransportOptions };

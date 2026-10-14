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
import { guardStep, instrumentationStep } from '#adapter/features/front-steps/index';
import type { OnRequestHook, OnResponseHook } from '#adapter/features/front-steps/index';
import { RouteAdapter } from '#adapter/core/route/route-adapter';
import { mountSse } from '#adapter/features/sse';

type ClosingOptions = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

const DEFAULT_BODY_LIMIT = 1_048_576;

type SecureHeadersOptions = NonNullable<Parameters<typeof secureHeaders>[0]>;

interface TransportOptions {
  readonly bodyLimit?: number;
  readonly rawBody?: boolean;
  readonly secureHeaders?: boolean | SecureHeadersOptions;
  readonly transport: Transport;
  readonly trustProxy?: TrustProxy;
}

const HONOURED = new Set(['view engine', 'views']);

const REFUSED: Readonly<Record<string, string>> = {
  env: 'it has no behaviour in this adapter',
  etag: 'it has no behaviour in this adapter',
  'query parser': 'it has no behaviour in this adapter',
  'trust proxy':
    'the transport reads it when the adapter is constructed, so it is set through the adapter options',
  'x-powered-by': 'it has no behaviour in this adapter',
};

const refuse = (name: string, why?: string): never => {
  const reason = why ?? REFUSED[name] ?? 'it has no behaviour in this adapter';
  throw new Error(`set() cannot honour the "${name}" setting: ${reason}.`);
};

const settingValue = (name: string, value: unknown): string | readonly string[] => {
  if (!HONOURED.has(name)) {
    refuse(name);
  }
  if (typeof value === 'string') return value;
  if (
    name === 'views' &&
    Array.isArray(value) &&
    value.every((directory: unknown) => typeof directory === 'string')
  ) {
    return value;
  }
  if (name === 'views') return refuse(name, 'it takes a string or a string array');
  return refuse(name, 'it takes a string');
};

// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
abstract class HonoLifecycle extends RouteAdapter {
  protected readonly hono: NestHono;
  protected readonly interceptor = mountSse;
  protected readonly transport: Transport;
  protected readonly trustProxy: TrustProxy;
  protected bodyLimit: number;
  protected bodyParsingEnabled = false;
  protected rawBodyEnabled: boolean;
  protected corsOptions: CorsConfig | undefined;
  private onRequestHook: OnRequestHook | undefined;
  private onResponseHook: OnResponseHook | undefined;
  private closing = false;
  private forceCloseConnections = false;
  private return503OnClosing = false;

  /**
   * Installs everything the application is built with before a route is registered: the security
   * headers, the request steps, and the compatibility bridges. Kept apart from the constructor so
   * the constructor reads as the field initialisation it is.
   */
  private installPieces(hono: NestHono, options: TransportOptions): void {
    this.installSecurityHeaders(options.secureHeaders ?? false);
    this.installGuards(hono);
    installBridges({ hono, transport: this.transport });
  }

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

  private installGuards(hono: NestHono): void {
    const cors = corsBridge(() => this.corsOptions, this.trustProxy);
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

  public override getType(): 'hono' {
    return 'hono';
  }

  public getHono(): NestHono {
    return this.hono;
  }

  public override getHttpServer(): Server & NativeServer {
    return this.httpServer as Server & NativeServer;
  }

  public isRouteOrderSensitive(): boolean {
    return false;
  }

  public override setOnRequestHook(hook: OnRequestHook): void {
    this.onRequestHook = hook;
  }

  public override setOnResponseHook(hook: OnResponseHook): void {
    this.onResponseHook = hook;
  }

  private readShutdownOptions(options: NestApplicationOptions): void {
    const closing: ClosingOptions = options;
    this.forceCloseConnections = options.forceCloseConnections ?? false;
    this.return503OnClosing = closing.return503OnClosing ?? false;
  }

  public override initHttpServer(options: NestApplicationOptions): void {
    this.readShutdownOptions(options);
    if (options.rawBody === true) this.rawBodyEnabled = true;
    this.setHttpServer(
      this.transport.createServer(this.hono, {
        httpsOptions: options.httpsOptions,
      }),
    );
  }

  public getTransport(): Transport {
    return this.transport;
  }

  public override listen(port: string | number, callback?: () => void): void;
  public override listen(port: string | number, hostname: string, callback?: () => void): void;
  public override listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    if (typeof hostnameOrCallback === 'string') {
      this.httpServer.listen(port, hostnameOrCallback, callback);
      return;
    }
    this.httpServer.listen(port, hostnameOrCallback);
  }

  public override async close(): Promise<void> {
    this.closing = true;
    await this.httpServer.close(this.forceCloseConnections);
  }

  protected keepRawBody(rawBody?: boolean): void {
    if (rawBody === true) this.rawBodyEnabled = true;
  }

  private installSecurityHeaders(headers: boolean | SecureHeadersOptions): void {
    if (headers === true) {
      this.hono.use('*', secureHeaders());
      return;
    }
    if (headers !== false) this.hono.use('*', secureHeaders(headers));
  }
}

interface HonoLifecycle {
  beforeClose: () => void;

  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the base declares this parameter; an accessor whose caller names a type cannot be narrowed to one return type.
  getInstance: <TInstance = NestHono>() => TInstance;
}

export { HonoLifecycle, settingValue };
export type { TransportOptions };

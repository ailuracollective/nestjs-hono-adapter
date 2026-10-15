import { settleBridges } from '#adapter/compat/index';
import type { CorsConfig } from '#adapter/features/cors/index';
import { toByteLimit } from '#adapter/core/request/body/index';
import type { BodyParserOptions, SecurityHook } from '#adapter/core/request/body/index';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestHandler, NestRequest } from '#adapter/core/request/request';
import type { NestContext } from '#adapter/core/context';
import {
  createExceptionRunner,
  createMiddlewareHandler,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
} from '#adapter/core/route/handler-bridge';
import type { BridgeOptions, NestExceptionHandler } from '#adapter/core/route/handler-bridge';
import { HonoLifecycle, settingValue, toTrustProxy } from './hono-lifecycle.ts';
import type { TransportOptions } from './hono-lifecycle.ts';
import type { TransportChoiceOptions } from './server-options.ts';
import { toHonoPath } from '#adapter/core/request/path';

import { ResponseWriter } from '#adapter/core/response/response-writer';
import { ALL_METHOD } from '#adapter/core/route/route-adapter';
import { parsesMultipart, rememberAdapter } from '#adapter/core/multipart';
import { bunServer } from '#adapter/servers/bun';
import { mountStaticAssets } from '#adapter/features/static-assets/index';
import type { StaticAssetsOptions } from '#adapter/features/static-assets/index';
import { ViewRenderer } from '#adapter/features/views/index';
import type { EngineConfig, ViewOptions } from '#adapter/features/views/index';

interface ServerAdapterOptions extends TransportChoiceOptions {
  readonly views?: ViewOptions;
}

const withTransport = (options: ServerAdapterOptions): TransportOptions => {
  const transport = options.transport ?? bunServer();
  return Object.assign({}, options, { transport });
};

const TRAILING_WILDCARD = /\/\*$/u;

// Express hands a middleware mounted at a sub-path a request whose `url` starts after the mount and
// puts the mount on `baseUrl`. Only a literal prefix can be named that way, so a parameterised
// mount is left alone rather than guessed at.
const mountBase = (path: string): string | undefined => {
  const base = path.replace(TRAILING_WILDCARD, '').replace(/\/+$/u, '');
  if (base === '' || base.includes(':') || base.includes('*')) return undefined;
  return base;
};

// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
class ServerAdapter extends HonoLifecycle {
  private readonly writer = new ResponseWriter();
  private readonly views: ViewRenderer;

  public constructor(options: ServerAdapterOptions = {}) {
    super(withTransport(options));
    this.views = new ViewRenderer(options.views);
    this.installMapException();
    this.installSecurityHook();
    rememberAdapter(this);
  }

  public override status(response: NestContext, statusCode: number): void {
    this.writer.status(response, statusCode);
  }

  public override reply(response: NestContext, body: unknown, statusCode?: number): void {
    this.writer.reply(response, body, statusCode);
  }

  public override end(response: NestContext, message?: string): void {
    this.writer.end(response, message);
  }

  public override redirect(response: NestContext, statusCode: number, url: string): void {
    this.writer.redirect(response, statusCode, url);
  }

  public override setHeader(response: NestContext, name: string, value: string): void {
    this.writer.setHeader(response, name, value);
  }

  public override getHeader(response: NestContext, name: string): string | undefined {
    return this.writer.getHeader(response, name);
  }

  public override appendHeader(response: NestContext, name: string, value: string): void {
    this.writer.appendHeader(response, name, value);
  }

  public override isHeadersSent(response: NestContext): boolean {
    return this.writer.isHeadersSent(response);
  }

  public override async render(
    response: NestContext,
    view: string,
    options: unknown,
  ): Promise<void> {
    const html = await this.views.render(view, options);
    this.writer.view(response, html);
  }

  public override setViewEngine(engine: EngineConfig): this {
    this.views.useEngine(engine);
    return this;
  }

  // `app.engine('hbs', hbs.__express)` — the Express selector, kept by extension.
  public engine(extension: string, engine: unknown): this {
    this.views.useEngineFor(extension, engine);
    return this;
  }

  public setBaseViewsDir(directory: string | readonly string[]): this {
    this.views.useDirectories(directory);
    return this;
  }

  public override useStaticAssets(
    path: StaticAssetsOptions | string | readonly string[],
    options?: StaticAssetsOptions,
  ): this {
    mountStaticAssets({
      hono: this.hono,
      options,
      path,
      transport: this.transport,
    });
    return this;
  }

  public override enableCors(options?: CorsConfig): void {
    this.corsOptions = options ?? {};
  }

  public override getRequestMethod(request: NestRequest): string {
    return request.method;
  }

  public override getRequestUrl(request: NestRequest): string {
    return request.originalUrl;
  }

  public override getRequestHostname(request: NestRequest): string {
    return request.hostname;
  }

  public override registerParserMiddleware(_prefix?: string, rawBody?: boolean): void {
    this.bodyParsingEnabled = true;
    this.keepRawBody(rawBody);
  }

  public useBodyParser(type?: string, rawBody?: boolean, options?: BodyParserOptions): void {
    if (type !== undefined && !['json', 'urlencoded', 'text', 'raw'].includes(type)) {
      throw new TypeError(`Unsupported parser "${type}"`);
    }
    for (const name of Object.keys(options ?? {})) {
      if (name !== 'limit') {
        throw new TypeError(`useBodyParser() cannot honour the "${name}" option.`);
      }
    }
    this.bodyParsingEnabled = true;
    this.keepRawBody(rawBody);
    this.applyLimit(options);
  }

  private installSecurityHook(): void {
    this.registerSecurityHook = (hook: SecurityHook): void => {
      this.hono.use('*', (context, next) => {
        const request = toNestRequest(context, {
          trustProxy: this.trustProxy,
        });
        const failure = hook(
          request,
          context.env.outgoing ?? {
            removeHeader: (name: string): void => {
              context.res.headers.delete(name);
            },
            setHeader: (name: string, value: string): void => {
              context.header(name, value);
            },
          },
        );
        if (failure instanceof Error) throw failure;
        return next();
      });
    };
  }

  private installMapException(): void {
    this.mapException = mapFrameworkError;
  }

  // Lets the compatibility bridges finish installing inside Nest's `init()` window, the one a
  // prototype-patching bridge needs; a bridge with nothing to resolve installs in the constructor.
  public override async init(): Promise<void> {
    await settleBridges();
  }

  public override setNotFoundHandler(handler: NestHandler): void {
    this.hono.notFound((context) => runNestHandler(handler, context, this.bridgeOptions));
  }

  public override setErrorHandler(handler: NestExceptionHandler): void {
    const run = createExceptionRunner(handler, this.bridgeOptions);
    this.hono.onError((error, context) => run(error, context));
  }

  protected override register(method: string, path: string, handler: NestHandler): void {
    const honoPath = toHonoPath(path);
    const honoHandler = createRouteHandler(handler, this.bridgeOptions, this.interceptor);
    if (method === ALL_METHOD) {
      this.hono.all(honoPath, honoHandler);
      return;
    }
    this.hono.on(method, honoPath, honoHandler);
  }

  protected override mount(path: string, handler: NestHandler): void {
    this.hono.use(
      toHonoPath(path),
      createMiddlewareHandler(
        { base: mountBase(path), handler },
        this.bridgeOptions,
        this.interceptor,
      ),
    );
  }

  private get bridgeOptions(): BridgeOptions {
    return {
      bodyLimit: () => this.effectiveBodyLimit(),
      bodyParsingEnabled: () => this.bodyParsingEnabled,
      multipart: () => parsesMultipart(this),
      pendingStatus: (context) => this.writer.statusOf(context),
      rawBody: () => this.rawBodyEnabled,
      trustProxy: () => this.trustProxy,
    };
  }

  private applyLimit(options?: BodyParserOptions): void {
    if (options === undefined) return;
    if (options.limit === undefined) return;
    this.bodyLimit = toByteLimit(options.limit);
  }

  private effectiveBodyLimit(): number | undefined {
    if (this.bodyLimit === 0) return undefined;
    return this.bodyLimit;
  }

  public setLocal(key: string, value: unknown): this {
    this.views.setLocal(key, value);
    return this;
  }

  public set(name: string, value: unknown): this {
    // `trust proxy` and `etag` are read per request, so an application may set them at bootstrap the
    // way Express apps do rather than through the adapter options.
    if (name === 'trust proxy') {
      this.trustProxy = toTrustProxy(value);
      return this;
    }
    if (name === 'etag') {
      this.writer.useEtag(value);
      return this;
    }
    const setting = settingValue(name, value);
    if (name === 'view engine' && typeof setting === 'string') return this.setViewEngine(setting);
    return this.setBaseViewsDir(setting);
  }

  public enable(name: string): this {
    return this.set(name, true);
  }

  public disable(name: string): this {
    return this.set(name, false);
  }
}

interface ServerAdapter {
  mapException: (error: unknown) => unknown;
  registerSecurityHook: (hook: SecurityHook) => void;
}

export { ServerAdapter };

export type { ServerAdapterOptions };

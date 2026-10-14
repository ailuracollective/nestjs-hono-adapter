import { settleBridges } from '#adapter/compat/index';
import type { CorsConfig } from '#adapter/features/cors/index';
import { toByteLimit } from '#adapter/core/request/body/index';
import type { BodyParserOptions, SecurityHook } from '#adapter/core/request/body/index';
import { toNestRequest } from '#adapter/core/request/request';
import type { NestHandler, NestRequest } from '#adapter/core/request/request';
import type { NestContext } from '#adapter/core/context';
import {
  createExceptionRunner,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
} from '#adapter/core/route/handler-bridge';
import type { BridgeOptions, NestExceptionHandler } from '#adapter/core/route/handler-bridge';
import { HonoLifecycle, settingValue } from './hono-lifecycle.ts';
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

  /**
   * Lets the compatibility bridges finish installing. Nest awaits `init()` before it runs
   * `onModuleInit`, which is the window a bridge that patches a third-party prototype has to land
   * in: `@nestjs/serve-static` would otherwise boot against its own Express loader. A bridge with
   * nothing to resolve installs synchronously in the constructor, so this is an already-settled
   * await for a deployment that runs none of them.
   */
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
      createRouteHandler(handler, this.bridgeOptions, this.interceptor),
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

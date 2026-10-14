import type { CorsConfig } from '#adapter/features/cors/index';
import { toByteLimit } from '#adapter/core/request/body/index';
import type {
  BodyParserOptions,
  SecurityHook,
} from '#adapter/core/request/body/index';
import { toNestRequest } from '#adapter/core/request/request';
import type {
  NestHandler,
  NestRequest,
} from '#adapter/core/request/request';
import type { NestContext } from '#adapter/core/context';
import {
  createExceptionRunner,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
} from '#adapter/core/route/handler-bridge';
import type {
  BridgeOptions,
  NestExceptionHandler,
} from '#adapter/core/route/handler-bridge';
import {
  HonoLifecycle,
  settingValue,
} from './hono-lifecycle.ts';
import type { TransportOptions } from './hono-lifecycle.ts';
import type { TransportChoiceOptions } from './server-options.ts';
import { toHonoPath } from '#adapter/core/request/path';
import { ResponseWriter } from '#adapter/core/response/response-writer';
import { ALL_METHOD } from '#adapter/core/route/route-adapter';
import {
  parsesMultipart,
  rememberAdapter,
} from '#adapter/core/multipart';
import { bunServer } from '#adapter/servers/bun';
import { mountStaticAssets } from '#adapter/features/static-assets/index';
import type { StaticAssetsOptions } from '#adapter/features/static-assets/index';
import { ViewRenderer } from '#adapter/features/views/index';
import type {
  EngineConfig,
  ViewOptions,
} from '#adapter/features/views/index';

/** The options the adapter itself reads. */
interface ServerAdapterOptions extends TransportChoiceOptions {
  /** The views a handler may render. */
  readonly views?: ViewOptions;
}

/** Fills in the transport a deployment named none. */
const withTransport = (
  options: ServerAdapterOptions,
): TransportOptions => {
  const transport = options.transport ?? bunServer();
  return Object.assign({}, options, { transport });
};

/** HTTP adapter that runs Nest on Hono. */
// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
class ServerAdapter extends HonoLifecycle {
  /** Writes answers onto the request context. */
  private readonly writer = new ResponseWriter();
  /** Renders the views this deployment configured. */
  private readonly views: ViewRenderer;

  /** Builds the adapter on the options it was given. */
  public constructor(options: ServerAdapterOptions = {}) {
    super(withTransport(options));
    this.views = new ViewRenderer(options.views);
    this.installMapException();
    this.installSecurityHook();
    rememberAdapter(this);
  }

  /** Records the status Nest asked for. */
  public override status(
    response: NestContext,
    statusCode: number,
  ): void {
    this.writer.status(response, statusCode);
  }

  /** Writes the body Nest answered with. */
  public override reply(
    response: NestContext,
    body: unknown,
    statusCode?: number,
  ): void {
    this.writer.reply(response, body, statusCode);
  }

  /** Ends the answer with an optional message. */
  public override end(
    response: NestContext,
    message?: string,
  ): void {
    this.writer.end(response, message);
  }

  /** Answers with a redirect to a URL. */
  public override redirect(
    response: NestContext,
    statusCode: number,
    url: string,
  ): void {
    this.writer.redirect(response, statusCode, url);
  }

  /** Sets one response header. */
  public override setHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    this.writer.setHeader(response, name, value);
  }

  /** Reads one response header. */
  public override getHeader(
    response: NestContext,
    name: string,
  ): string | undefined {
    return this.writer.getHeader(response, name);
  }

  /** Appends one value to a response header. */
  public override appendHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    this.writer.appendHeader(response, name, value);
  }

  /** Whether the response has been sent. */
  public override isHeadersSent(
    response: NestContext,
  ): boolean {
    return this.writer.isHeadersSent(response);
  }

  /** Renders one view on the status Nest recorded. */
  public override async render(
    response: NestContext,
    view: string,
    options: unknown,
  ): Promise<void> {
    const html = await this.views.render(view, options);
    this.writer.view(response, html);
  }

  /** Configures the view engine. */
  public override setViewEngine(engine: EngineConfig): this {
    this.views.useEngine(engine);
    return this;
  }

  /** Names the directories a view is read from. */
  public setBaseViewsDir(
    directory: string | readonly string[],
  ): this {
    this.views.useDirectories(directory);
    return this;
  }

  /** Serves the directories named, in either transport's form. */
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

  /** Turns on the CORS middleware for this service. */
  public override enableCors(options?: CorsConfig): void {
    this.corsOptions = options ?? {};
  }

  /** The method of the request. */
  public override getRequestMethod(
    request: NestRequest,
  ): string {
    return request.method;
  }

  /** The URL of the request. */
  public override getRequestUrl(request: NestRequest): string {
    return request.originalUrl;
  }

  /** The hostname of the request. */
  public override getRequestHostname(
    request: NestRequest,
  ): string {
    return request.hostname;
  }

  /** Records that Nest wants parsed bodies. */
  public override registerParserMiddleware(
    _prefix?: string,
    rawBody?: boolean,
  ): void {
    this.bodyParsingEnabled = true;
    this.keepRawBody(rawBody);
  }

  /** Applies the body parser Nest asks for. */
  public useBodyParser(
    type?: string,
    rawBody?: boolean,
    options?: BodyParserOptions,
  ): void {
    if (
      type !== undefined &&
      !['json', 'urlencoded', 'text', 'raw'].includes(type)
    ) {
      throw new TypeError(`Unsupported parser "${type}"`);
    }
    for (const name of Object.keys(options ?? {})) {
      if (name !== 'limit') {
        throw new TypeError(
          `useBodyParser() cannot honour the "${name}" option.`,
        );
      }
    }
    this.bodyParsingEnabled = true;
    this.keepRawBody(rawBody);
    this.applyLimit(options);
  }

  /** Runs Nest's security hook in front of every route. */
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
        if (failure instanceof Error) {
          throw failure;
        }
        return next();
      });
    };
  }

  /** Installs the exception mapper as an own property. */
  private installMapException(): void {
    this.mapException = mapFrameworkError;
  }

  /** Sets the handler for unmatched requests. */
  public override setNotFoundHandler(
    handler: NestHandler,
  ): void {
    this.hono.notFound((context) =>
      runNestHandler(handler, context, this.bridgeOptions),
    );
  }

  /** Sets the handler for errors. */
  public override setErrorHandler(
    handler: NestExceptionHandler,
  ): void {
    const run = createExceptionRunner(
      handler,
      this.bridgeOptions,
    );
    this.hono.onError((error, context) => run(error, context));
  }

  /** Registers one route on the Hono application. */
  protected override register(
    method: string,
    path: string,
    handler: NestHandler,
  ): void {
    const honoPath = toHonoPath(path);
    const honoHandler = createRouteHandler(
      handler,
      this.bridgeOptions,
      this.interceptor,
    );
    if (method === ALL_METHOD) {
      this.hono.all(honoPath, honoHandler);
      return;
    }
    this.hono.on(method, honoPath, honoHandler);
  }

  /** Mounts middleware on the Hono application. */
  protected override mount(
    path: string,
    handler: NestHandler,
  ): void {
    this.hono.use(
      toHonoPath(path),
      createRouteHandler(
        handler,
        this.bridgeOptions,
        this.interceptor,
      ),
    );
  }

  /** The options the handler bridge reads. */
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

  /** Applies the size limit a parser named. */
  private applyLimit(options?: BodyParserOptions): void {
    if (options === undefined) {
      return;
    }
    if (options.limit === undefined) {
      return;
    }
    this.bodyLimit = toByteLimit(options.limit);
  }

  /** The body limit in force, or nothing when unchecked. */
  private effectiveBodyLimit(): number | undefined {
    if (this.bodyLimit === 0) {
      return undefined;
    }
    return this.bodyLimit;
  }

  /** Sets a local available to every render. */
  public setLocal(key: string, value: unknown): this {
    this.views.setLocal(key, value);
    return this;
  }

  /** Sets a setting this adapter honours, or refuses the name. */
  public set(name: string, value: unknown): this {
    const setting = settingValue(name, value);
    if (name === 'view engine' && typeof setting === 'string') {
      return this.setViewEngine(setting);
    }
    return this.setBaseViewsDir(setting);
  }

  /** Sets a setting to `true`. */
  public enable(name: string): this {
    return this.set(name, true);
  }

  /** Sets a setting to `false`. */
  public disable(name: string): this {
    return this.set(name, false);
  }
}

/** The members this class declares next to the base. */
interface ServerAdapter {
  /** Maps the errors the framework owns. */
  mapException: (error: unknown) => unknown;
  /** Registers a hook Nest runs for every request. */
  registerSecurityHook: (hook: SecurityHook) => void;
}

export { ServerAdapter };

export type { ServerAdapterOptions };

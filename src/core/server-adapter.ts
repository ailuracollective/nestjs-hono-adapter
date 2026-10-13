import type { CorsConfig } from '../features/cors-middleware.ts';
import { toByteLimit } from './body.ts';
import type {
  BodyParserOptions,
  SecurityHook,
} from './body.ts';
import { toNestRequest } from './request.ts';
import type { NestHandler, NestRequest } from './request.ts';
import type { NestContext } from './context.ts';
import {
  createExceptionRunner,
  createRouteHandler,
  mapFrameworkError,
  runNestHandler,
} from './handler-bridge.ts';
import type {
  BridgeOptions,
  NestExceptionHandler,
} from './handler-bridge.ts';
import {
  HonoLifecycle,
  settingValue,
} from './hono-lifecycle.ts';
import type { TransportOptions } from './hono-lifecycle.ts';
import type { TransportChoiceOptions } from './server-options.ts';
import { toHonoPath } from './path.ts';
import { ResponseWriter } from './response-writer.ts';
import { ALL_METHOD } from './route-adapter.ts';
import { parsesMultipart } from './multipart.ts';
import { nodeServer } from '../servers/node.ts';
import { mountStaticAssets } from '../features/static-assets.ts';
import type { StaticAssetsOptions } from '../features/static-assets.ts';
import { ViewRenderer } from '../features/views.ts';
import type {
  EngineConfig,
  ViewOptions,
} from '../features/views.ts';

/** The options the adapter itself reads. */
interface ServerAdapterOptions extends TransportChoiceOptions {
  /**
   * The views a handler may render, when the application has
   * any.
   */
  readonly views?: ViewOptions;
}

/**
 * Fills in the transport a deployment named none. It is the
 * Node one, with the global-object switch `@hono/node-server`
 * was handed before the transports split, so a bootstrap that
 * never names a runtime keeps answering with the bytes and the
 * behaviour it answered with then. A deployment that injects a
 * transport is answered from it and never reaches this.
 */
function withTransport(
  options: ServerAdapterOptions,
): TransportOptions {
  const transport =
    options.transport ??
    nodeServer({
      overrideGlobalObjects:
        options.overrideGlobalObjects ?? true,
    });
  return Object.assign({}, options, { transport });
}

/**
 * HTTP adapter that runs Nest on Hono.
 *
 * There is no official Hono adapter for Nest, so this one lives
 * in the repository. It implements the `AbstractHttpAdapter`
 * contract rather than wrapping another framework: routes are
 * registered on a Hono application, and Hono's Web `Request`
 * and `Response` are translated to and from the objects Nest
 * reads and writes. The application, the middleware chain and
 * the server lifecycle are inherited from {@link HonoLifecycle}.
 */
// oxlint-disable-next-line eslint/no-redeclare, typescript/no-unsafe-declaration-merging -- the interface below is the merged half of this class, on purpose.
class ServerAdapter extends HonoLifecycle {
  private readonly writer = new ResponseWriter();
  private readonly views: ViewRenderer;

  public constructor(options: ServerAdapterOptions = {}) {
    super(withTransport(options));
    this.views = new ViewRenderer(options.views);
    this.installMapException();
    this.installSecurityHook();
  }

  public override status(
    response: NestContext,
    statusCode: number,
  ): void {
    this.writer.status(response, statusCode);
  }

  public override reply(
    response: NestContext,
    body: unknown,
    statusCode?: number,
  ): void {
    this.writer.reply(response, body, statusCode);
  }

  public override end(
    response: NestContext,
    message?: string,
  ): void {
    this.writer.end(response, message);
  }

  public override redirect(
    response: NestContext,
    statusCode: number,
    url: string,
  ): void {
    this.writer.redirect(response, statusCode, url);
  }

  public override setHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    this.writer.setHeader(response, name, value);
  }

  public override getHeader(
    response: NestContext,
    name: string,
  ): string | undefined {
    return this.writer.getHeader(response, name);
  }

  public override appendHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    this.writer.appendHeader(response, name, value);
  }

  public override isHeadersSent(
    response: NestContext,
  ): boolean {
    return this.writer.isHeadersSent(response);
  }

  /** Renders one view with the engine the deployment gave. */
  public override render(
    response: NestContext,
    view: string,
    options: unknown,
  ): Promise<void> {
    return this.views.render(response, view, options);
  }

  /** Configures the views, by name or by Fastify's options. */
  public override setViewEngine(engine: EngineConfig): this {
    this.views.useEngine(engine);
    return this;
  }

  /**
   * Names the directories a view is read from. `HttpServer`
   * declares this one as returning the adapter, so it is
   * answered that way: a caller that chains off it reads the
   * same object Nest will go on to use.
   */
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

  /**
   * Turns on the CORS middleware for this service. It has to be
   * configured before the first request is served, which is how
   * Nest itself is used: the application is built, `enableCors`
   * is called on it, and only then does it listen. Until then
   * no origin is allowed.
   */
  public override enableCors(options?: CorsConfig): void {
    this.corsOptions = options ?? {};
  }

  public override getRequestMethod(
    request: NestRequest,
  ): string {
    return request.method;
  }

  public override getRequestUrl(request: NestRequest): string {
    return request.originalUrl;
  }

  public override getRequestHostname(
    request: NestRequest,
  ): string {
    return request.hostname;
  }

  /**
   * Records that Nest wants parsed bodies. The payload itself
   * is read per route in the handler bridge, because Hono
   * parses a body on demand rather than through middleware.
   */
  public override registerParserMiddleware(
    _prefix?: string,
    rawBody?: boolean,
  ): void {
    this.bodyParsingEnabled = true;
    this.keepRawBody(rawBody);
  }

  /**
   * `app.useBodyParser()` reaches the adapter here. Every
   * parser reads the same payload, selected by content type;
   * unsupported parser names are refused before state changes.
   * The size limit is the one option it reads. An option it
   * cannot carry out — `inflate`, `verify`, `extended` — is
   * refused by name here rather than accepted and dropped.
   */
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

  /**
   * Runs the request hook of Nest's built-in HTTP security
   * features in front of every route, handed the request it
   * reads and the raw response it writes — the same two objects
   * the Fastify adapter gives it, whose headers the transport
   * merges into whatever the route answers. Where the transport
   * is `@hono/node-server`, that response is the Node one a
   * deployment has always been handed; the Bun and fetch
   * transports get a Hono-backed stand-in. A failure it reports
   * is thrown onto the path the exception layer already owns.
   *
   * It is installed as an own property rather than written as a
   * method because `AbstractHttpAdapter` declares it only in
   * Nest versions published after 12.0.3, and
   * `noImplicitOverride` has no way to say "only where the base
   * has it".
   */
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

  /** Installed like the hook above, as an own property. */
  private installMapException(): void {
    this.mapException = mapFrameworkError;
  }

  public override setNotFoundHandler(
    handler: NestHandler,
  ): void {
    this.hono.notFound((context) =>
      runNestHandler(handler, context, this.bridgeOptions),
    );
  }

  public override setErrorHandler(
    handler: NestExceptionHandler,
  ): void {
    const run = createExceptionRunner(
      handler,
      this.bridgeOptions,
    );
    this.hono.onError((error, context) => run(error, context));
  }

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
    if (options === undefined) {
      return;
    }
    if (options.limit === undefined) {
      return;
    }
    this.bodyLimit = toByteLimit(options.limit);
  }

  /** A limit of nothing means the size is not checked. */
  private effectiveBodyLimit(): number | undefined {
    if (this.bodyLimit === 0) {
      return undefined;
    }
    return this.bodyLimit;
  }

  /** One local for every render, as Express's locals do. */
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

  /** Sets a setting to `true`, as Express's `enable` does. */
  public enable(name: string): this {
    return this.set(name, true);
  }

  /** Sets a setting to `false`, as Express's `disable` does. */
  public disable(name: string): this {
    return this.set(name, false);
  }
}

/**
 * The members this class declares next to the base rather than
 * in it, for the same reason as `beforeClose` above: Nest
 * declares neither in every version this package supports —
 * `registerSecurityHook` after 12.0.3, `mapException` only in
 * 12 — and `noImplicitOverride` has no way to say "only where
 * the base has it". The own properties their installers assign
 * satisfy both installs, and the signatures are this
 * repository's own, held by
 * `test/types/route-adapter-compat.ts` to what it documents.
 */
interface ServerAdapter {
  /** Maps the errors the framework owns. */
  mapException: (error: unknown) => unknown;
  /** Registers a hook Nest runs for every request. */
  registerSecurityHook: (hook: SecurityHook) => void;
}

export { ServerAdapter };

export type { ServerAdapterOptions };

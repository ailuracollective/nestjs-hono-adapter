import type { CorsOptions } from '../features/cors-middleware.ts';
import { toByteLimit } from './body.ts';
import { toNestRequest } from './request.ts';
import type { NestHandler, NestRequest } from './request.ts';
import type { NestContext } from './context.ts';
import type { Transport } from './transport.ts';
import {
  createExceptionRunner,
  createRouteHandler,
  runNestHandler,
} from './handler-bridge.ts';
import type {
  BridgeOptions,
  NestExceptionHandler,
} from './handler-bridge.ts';
import { HonoLifecycle } from './hono-lifecycle.ts';
import type { TransportOptions } from './hono-lifecycle.ts';
import { toHonoPath } from './path.ts';
import { ResponseWriter } from './response-writer.ts';
import { ALL_METHOD } from './route-adapter.ts';
import { nodeServer } from '../servers/node.ts';
import { mountStaticAssets } from '../features/static-assets.ts';
import type { StaticAssetsOptions } from '../features/static-assets.ts';
import { ViewRenderer } from '../features/views.ts';
import type { ViewOptions } from '../features/views.ts';

/** The options the adapter itself reads. */
interface ServerAdapterOptions extends Omit<
  TransportOptions,
  'transport'
> {
  /**
   * Whether `@hono/node-server` may replace the global
   * `Request` and `Response` with its lighter classes. Read
   * only where no transport is named, because it is a switch on
   * the transport the adapter picks itself: it is the option
   * every deployment set before the transports split, and it is
   * handed to the Node transport with the default it always
   * had. `nodeServer()` takes its own, for the deployment that
   * names the transport instead of relying on this.
   */
  readonly overrideGlobalObjects?: boolean;
  /**
   * The runtime to serve through. Left out, the adapter serves
   * through the Node transport — the runtime every deployment
   * was served by before the transports split, which runs on
   * Bun as well as on Node. `bunServer()` picks Bun's own
   * server instead, and `fetchServer()` a host that hands over
   * a Web `Request`.
   */
  readonly transport?: Transport;
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

/** The options Nest hands the parser middleware. */
interface BodyParserOptions {
  readonly limit?: number | string;
}

/**
 * The hook Nest's built-in HTTP security features register, as
 * the base class types it.
 */
type SecurityHook = (
  request: NestRequest,
  response: {
    setHeader: (name: string, value: string) => unknown;
    removeHeader: (name: string) => unknown;
  },
) => Error | undefined;

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

  /** Names the engine, by the extension it renders. */
  public override setViewEngine(engine: string): this {
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

  /**
   * Serves the files in a directory, under the prefix asked
   * for.
   */
  public override useStaticAssets(
    path: string | readonly string[],
    options?: StaticAssetsOptions,
  ): this {
    mountStaticAssets({
      hono: this.hono,
      options: options ?? {},
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
  public override enableCors(options?: CorsOptions): void {
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
   * parser reads the same payload, so the type is not branched
   * on; the size limit is, because it is the option a
   * deployment sets.
   */
  public useBodyParser(
    _type?: string,
    rawBody?: boolean,
    options?: BodyParserOptions,
  ): void {
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
}

/**
 * The member this class declares next to the base rather than
 * in it, for the same reason as `beforeClose` above: Nest
 * declares it only from 12.0.3 on, and `noImplicitOverride` has
 * no way to say "only where the base has it". The assigned own
 * property `installSecurityHook` fills in is what satisfies
 * both installs. The signature is this repository's own rather
 * than the base's, so `test/types/route-adapter-compat.ts`
 * holds it to what this repository documents as well as to the
 * base.
 */
interface ServerAdapter {
  /** Registers a hook Nest runs for every request. */
  registerSecurityHook: (hook: SecurityHook) => void;
}

declare module '@nestjs/common' {
  /**
   * The application methods this adapter implements. Nest
   * declares them on its own platform interfaces, which an
   * application on Hono does not otherwise have.
   */
  interface INestApplication<TServer> {
    /** Serves the files in a directory, at the prefix asked for. */
    useStaticAssets: (
      path: string | readonly string[],
      options?: StaticAssetsOptions,
    ) => this;
    /** Names the directories a view is read from. */
    setBaseViewsDir: (
      directory: string | readonly string[],
    ) => this;
    /** Names the view engine, by the extension it renders. */
    setViewEngine: (engine: string) => this;
  }
}

export { ServerAdapter };

export type { SecurityHook, ServerAdapterOptions };

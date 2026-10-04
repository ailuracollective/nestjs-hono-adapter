import { toByteLimit } from './body.ts';
import type { NestHandler, NestRequest } from './request.ts';
import type { NestContext } from './context.ts';
import type { CorsOptions } from '../features/cors-middleware.ts';
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
import { mountSse } from '../features/sse.ts';
import { mountStaticAssets } from '../features/static-assets.ts';
import type { StaticAssetsOptions } from '../features/static-assets.ts';
import { ViewRenderer } from '../features/views.ts';
import type { ViewOptions } from '../features/views.ts';

/** The options the adapter itself reads. */
interface ServerAdapterOptions extends TransportOptions {
  /**
   * The views a handler may render, when the application has
   * any.
   */
  readonly views?: ViewOptions;
}

/** The options Nest hands the parser middleware. */
interface BodyParserOptions {
  readonly limit?: number | string;
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
 * the server lifecycle are inherited from {@link HonoLifecycle};
 * this class implements the rest of the Nest contract.
 */
class ServerAdapter extends HonoLifecycle {
  private readonly writer = new ResponseWriter();
  private readonly views: ViewRenderer;

  public constructor(options: ServerAdapterOptions = {}) {
    super(options);
    this.views = new ViewRenderer(options.views);
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
  public override setViewEngine(engine: string): void {
    this.views.useEngine(engine);
  }

  /** Names the directories a view is read from. */
  public setBaseViewsDir(
    directory: string | readonly string[],
  ): void {
    this.views.useDirectories(directory);
  }

  /**
   * Serves the files in a directory, under the prefix asked
   * for.
   */
  public override useStaticAssets(
    path: string | readonly string[],
    options?: StaticAssetsOptions,
  ): void {
    mountStaticAssets(this.hono, path, options ?? {});
  }

  /**
   * Turns on the CORS middleware for this service.
   *
   * It has to be configured before the first request is served,
   * which is how Nest itself is used: the application is built,
   * `enableCors` is called on it, and only then does it listen.
   * Until it is called no origin is allowed.
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
      mountSse,
    );
    if (method === ALL_METHOD) {
      this.hono.all(honoPath, honoHandler);
      return;
    }
    this.hono.on(method, honoPath, honoHandler);
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

export type { ServerAdapterOptions };

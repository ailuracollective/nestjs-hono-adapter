/**
 * The optional peers the bridge reads, resolved at install
 * time.
 */

/** The exception constructor the fallback answers with. */
type NotFoundShape = new (message: string) => ExceptionShape;

/** The one method the fallback reads off a Nest exception. */
interface ExceptionShape {
  getResponse: () => unknown;
}

/** The module whose `onModuleInit` the bridge swaps. */
interface ServeStaticShape {
  prototype: { onModuleInit?: ModuleInit };
}

/** The adapter Nest hands `ServeStaticModule` on its host. */
interface ServeStaticAdapter {
  getType?: () => string;
}

/** The `ServeStaticModule` instance the swap writes to. */
interface ServeStaticInstance {
  httpAdapterHost?: { httpAdapter?: ServeStaticAdapter };
  loader: unknown;
}

/** An `onModuleInit` as it is read off the prototype. */
type ModuleInit = (this: ServeStaticInstance) => unknown;

/** The one matcher shape this bridge reads. */
interface PathToRegexpShape {
  pathToRegexp: (path: string) => { regexp: RegExp };
}

/** The shape this bridge reads out of `@nestjs/serve-static`. */
interface PeerModule {
  readonly DEFAULT_EXPRESS_RENDER_PATH?: string;
  readonly DEFAULT_ROOT_PATH?: string;
  readonly NotFoundException?: NotFoundShape;
  readonly ServeStaticModule?: ServeStaticShape;
}

/** Both peers, either installed or not. */
interface Peers {
  /** The `path-to-regexp` peer, when it is installed. */
  readonly pathToRegexp: PathToRegexpShape | undefined;
  /** The `@nestjs/serve-static` peer, when it is installed. */
  readonly serveStatic: PeerModule | undefined;
}

/** The SPA fallback path the peer names. */
const DEFAULT_EXPRESS_RENDER_PATH = '{*any}';

/** The client directory the peer names. */
const DEFAULT_ROOT_PATH = 'client';

export { DEFAULT_EXPRESS_RENDER_PATH, DEFAULT_ROOT_PATH };
export type {
  ExceptionShape,
  ModuleInit,
  NotFoundShape,
  PathToRegexpShape,
  PeerModule,
  Peers,
  ServeStaticAdapter,
  ServeStaticInstance,
  ServeStaticShape,
};

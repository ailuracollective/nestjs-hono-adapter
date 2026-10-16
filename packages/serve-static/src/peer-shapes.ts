type NotFoundShape = new (message: string) => ExceptionShape;

interface ExceptionShape {
  getResponse: () => unknown;
}

interface ServeStaticShape {
  prototype: { onModuleInit?: ModuleInit };
}

interface ServeStaticAdapter {
  getType?: () => string;
}

interface ServeStaticInstance {
  httpAdapterHost?: { httpAdapter?: ServeStaticAdapter };
  loader: unknown;
}

type ModuleInit = (this: ServeStaticInstance) => unknown;

interface PathToRegexpShape {
  pathToRegexp: (path: string) => { regexp: RegExp };
}

interface PeerModule {
  readonly DEFAULT_EXPRESS_RENDER_PATH?: string;
  readonly DEFAULT_ROOT_PATH?: string;
  readonly NotFoundException?: NotFoundShape;
  readonly ServeStaticModule?: ServeStaticShape;
}

interface Peers {
  readonly pathToRegexp: PathToRegexpShape | undefined;
  readonly serveStatic: PeerModule | undefined;
}

const DEFAULT_EXPRESS_RENDER_PATH = '{*any}';

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

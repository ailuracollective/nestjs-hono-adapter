import { Server } from 'socket.io';
import type { ServerOptions } from 'socket.io';

const DEFAULT_PATH = '/socket.io/';

interface BunEngine {
  readonly handleRequest: (request: Request, server: unknown) => Promise<Response>;
  readonly handler: () => {
    readonly websocket: unknown;
    readonly idleTimeout: number;
  };
  readonly close: () => void;
}

interface BunEngineModule {
  readonly Server: new (options: BunEngineOptions) => BunEngine;
}

interface BunEngineOptions {
  readonly path: string;
  readonly cors?: ServerOptions['cors'] | undefined;
  readonly maxHttpBufferSize?: number | undefined;
  readonly pingInterval?: number | undefined;
  readonly pingTimeout?: number | undefined;
  readonly upgradeTimeout?: number | undefined;
}

type ForwardedEngineOptions = Omit<BunEngineOptions, 'path'>;

const ENGINE_KEYS = new Set<keyof ForwardedEngineOptions>([
  'cors',
  'maxHttpBufferSize',
  'pingInterval',
  'pingTimeout',
  'upgradeTimeout',
]);

interface NativeHandler {
  readonly handleRequest: (
    request: Request,
    server: unknown,
  ) => Response | Promise<Response> | undefined;
  readonly idleTimeout: number;
  readonly websocket: unknown;
}

interface NativeHost {
  readonly useNativeHandler: (handler: NativeHandler) => void;
}

interface Attached {
  readonly io: Server;
  readonly engine: BunEngine;
}

const isEngineModule = (value: unknown): value is BunEngineModule =>
  typeof value === 'object' && value !== null && 'Server' in value;

const loadEngine = async (): Promise<BunEngineModule | undefined> => {
  if (typeof Bun === 'undefined') return undefined;
  try {
    const loaded: unknown = await import('@socket.io/bun-engine');
    return isEngineModule(loaded) ? loaded : undefined;
  } catch {
    return undefined;
  }
};

// oxlint-disable-next-line node/no-top-level-await -- the module has to be resolved before a gateway asks for its server, and this package publishes ESM only: `require(esm)` is not a loading path it supports.
const bunEngine = await loadEngine();

const isNativeHost = (value: unknown): value is NativeHost =>
  typeof value === 'object' &&
  value !== null &&
  'useNativeHandler' in value &&
  typeof value.useNativeHandler === 'function';

const forwardedOptions = (options: ServerOptions | undefined): ForwardedEngineOptions => {
  const forwarded: ForwardedEngineOptions = {};
  if (options === undefined) return forwarded;
  for (const key of ENGINE_KEYS) {
    const value = options[key];
    if (value !== undefined) Reflect.set(forwarded, key, value);
  }
  return forwarded;
};

const attachEngine = (host: unknown, options?: ServerOptions): Attached | undefined => {
  if (bunEngine === undefined || !isNativeHost(host)) {
    return undefined;
  }
  const path = options?.path ?? DEFAULT_PATH;
  const engine = new bunEngine.Server(Object.assign(forwardedOptions(options), { path }));
  const io = new Server(options);
  io.bind(engine);
  const { websocket, idleTimeout } = engine.handler();
  host.useNativeHandler({
    handleRequest: (request, server) =>
      new URL(request.url).pathname === path ? engine.handleRequest(request, server) : undefined,
    idleTimeout,
    websocket,
  });
  return { engine, io };
};

export { attachEngine };
export type { Attached, BunEngine, NativeHandler };

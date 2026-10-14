import { Server } from 'socket.io';
import type { ServerOptions } from 'socket.io';

/** The path a socket.io client connects to by default. */
const DEFAULT_PATH = '/socket.io/';

/** The engine `@socket.io/bun-engine` answers with. */
interface BunEngine {
  /** Answers one HTTP request the engine owns. */
  readonly handleRequest: (
    request: Request,
    server: unknown,
  ) => Promise<Response>;
  /** The handlers Bun serves it through. */
  readonly handler: () => {
    /** The handler Bun upgrades WebSocket requests with. */
    readonly websocket: unknown;
    /** The seconds Bun keeps an idle connection. */
    readonly idleTimeout: number;
  };
  /** Closes every client. */
  readonly close: () => void;
}

/** The module `@socket.io/bun-engine` publishes. */
interface BunEngineModule {
  /** A socket.io engine that serves through `Bun.serve`. */
  readonly Server: new (options: BunEngineOptions) => BunEngine;
}

/** The engine options the adapter forwards from socket.io. */
interface BunEngineOptions {
  /** The path the engine owns. */
  readonly path: string;
  /** The CORS policy the engine answers with. */
  readonly cors?: ServerOptions['cors'] | undefined;
  /** The largest message the engine accepts, in bytes. */
  readonly maxHttpBufferSize?: number | undefined;
  /** How often the engine pings an idle client, in ms. */
  readonly pingInterval?: number | undefined;
  /** How long the engine waits for a pong, in ms. */
  readonly pingTimeout?: number | undefined;
  /** How long the engine waits for an upgrade, in ms. */
  readonly upgradeTimeout?: number | undefined;
}

/** The engine options, before the path is named. */
type ForwardedEngineOptions = Omit<BunEngineOptions, 'path'>;

/** The keys socket.io's options and the Bun engine share. */
const ENGINE_KEYS = new Set<keyof ForwardedEngineOptions>([
  'cors',
  'maxHttpBufferSize',
  'pingInterval',
  'pingTimeout',
  'upgradeTimeout',
]);

/**
 * What a capability installs on a runtime's native websocket
 * slot.
 */
interface NativeHandler {
  /**
   * Answers a request the capability owns, or none to fall
   * through.
   */
  readonly handleRequest: (
    request: Request,
    server: unknown,
  ) => Response | Promise<Response> | undefined;
  /** The seconds the runtime keeps an idle connection. */
  readonly idleTimeout: number;
  /** The handler the runtime upgrades WebSocket requests with. */
  readonly websocket: unknown;
}

/**
 * The server a native handler is installed on, where it offers
 * one.
 */
interface NativeHost {
  /**
   * Installs a handler beside the application, before the
   * server starts.
   */
  readonly useNativeHandler: (handler: NativeHandler) => void;
}

/** A socket.io server bound to a Bun engine. */
interface Attached {
  /** The server the gateways answer through. */
  readonly io: Server;
  /** The engine Bun serves it with. */
  readonly engine: BunEngine;
}

/** Says whether a value is the module the Bun engine publishes. */
const isEngineModule = (
  value: unknown,
): value is BunEngineModule =>
  typeof value === 'object' &&
  value !== null &&
  'Server' in value;

/** Loads the Bun engine where the runtime provides it. */
const loadEngine = async (): Promise<
  BunEngineModule | undefined
> => {
  if (typeof Bun === 'undefined') {
    return undefined;
  }
  try {
    const loaded: unknown =
      await import('@socket.io/bun-engine');
    return isEngineModule(loaded) ? loaded : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The Bun engine module, or none where the runtime or the
 * package is absent.
 */
// oxlint-disable-next-line node/no-top-level-await -- the module has to be resolved before a gateway asks for its server, and this package publishes ESM only: `require(esm)` is not a loading path it supports.
const bunEngine = await loadEngine();

/**
 * Says whether a value is a server that offers the native
 * websocket slot.
 */
const isNativeHost = (value: unknown): value is NativeHost =>
  typeof value === 'object' &&
  value !== null &&
  'useNativeHandler' in value &&
  typeof value.useNativeHandler === 'function';

/** The engine options socket.io names, undefined ones left out. */
const forwardedOptions = (
  options: ServerOptions | undefined,
): ForwardedEngineOptions => {
  const forwarded: ForwardedEngineOptions = {};
  if (options === undefined) {
    return forwarded;
  }
  for (const key of ENGINE_KEYS) {
    const value = options[key];
    if (value !== undefined) {
      Reflect.set(forwarded, key, value);
    }
  }
  return forwarded;
};

/**
 * Binds a socket.io server to a Bun engine on the server it
 * answers with.
 */
const attachEngine = (
  host: unknown,
  options?: ServerOptions,
): Attached | undefined => {
  if (bunEngine === undefined || !isNativeHost(host)) {
    return undefined;
  }
  const path = options?.path ?? DEFAULT_PATH;
  const engine = new bunEngine.Server(
    Object.assign(forwardedOptions(options), { path }),
  );
  const io = new Server(options);
  io.bind(engine);
  const { websocket, idleTimeout } = engine.handler();
  host.useNativeHandler({
    handleRequest: (request, server) =>
      new URL(request.url).pathname === path
        ? engine.handleRequest(request, server)
        : undefined,
    idleTimeout,
    websocket,
  });
  return { engine, io };
};

export { attachEngine };
export type { Attached, BunEngine, NativeHandler };

import type { Server, ServerOptions } from 'socket.io';

import type { BunEngine, BunEngineOptions, Kit } from './kit.ts';

const DEFAULT_PATH = '/socket.io/';

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

const isNativeHost = (value: unknown): value is NativeHost =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'useNativeHandler') === 'function';

const forwardedOptions = (options?: ServerOptions): ForwardedEngineOptions => {
  const forwarded: ForwardedEngineOptions = {};
  if (options === undefined) return forwarded;
  for (const key of ENGINE_KEYS) {
    const value = options[key];
    if (value !== undefined) Reflect.set(forwarded, key, value);
  }
  return forwarded;
};

/**
 * The Bun transport's native slot, which is the only place an engine can bind: the engine answers
 * the upgrade and owns the websocket, and the socket.io server keeps answering the protocol.
 */
const attachEngine = (
  host: unknown,
  kit: Kit | undefined,
  options?: ServerOptions,
): Server | undefined => {
  if (kit === undefined || !isNativeHost(host)) return undefined;
  const { engine } = kit;
  if (engine === undefined) return undefined;
  const path = options?.path ?? DEFAULT_PATH;
  const built: BunEngine = new engine.Server(Object.assign(forwardedOptions(options), { path }));
  const io = new kit.Server(options);
  io.bind(built);
  const { websocket, idleTimeout } = built.handler();
  host.useNativeHandler({
    handleRequest: (request, server) =>
      new URL(request.url).pathname === path ? built.handleRequest(request, server) : undefined,
    idleTimeout,
    websocket,
  });
  return io;
};

export { attachEngine };
export type { NativeHandler };

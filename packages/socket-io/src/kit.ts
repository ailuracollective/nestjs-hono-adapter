import { loadPeer } from '@ailura/nestjs-hono-adapter';
import type { Server, ServerOptions } from 'socket.io';

interface BunEngine {
  readonly handleRequest: (request: Request, server: unknown) => Promise<Response>;
  readonly handler: () => {
    readonly websocket: unknown;
    readonly idleTimeout: number;
  };
  readonly close: () => void;
}

interface BunEngineOptions {
  readonly path: string;
  readonly cors?: ServerOptions['cors'] | undefined;
  readonly maxHttpBufferSize?: number | undefined;
  readonly pingInterval?: number | undefined;
  readonly pingTimeout?: number | undefined;
  readonly upgradeTimeout?: number | undefined;
}

interface BunEngineModule {
  readonly Server: new (options: BunEngineOptions) => BunEngine;
}

interface Kit {
  readonly Server: new (options?: ServerOptions) => Server;
  readonly engine: BunEngineModule | undefined;
}

const isEngineModule = (value: unknown): value is BunEngineModule =>
  typeof value === 'object' && value !== null && 'Server' in value;

const isServerClass = (value: unknown): value is new (options?: ServerOptions) => Server =>
  typeof value === 'function';

const engineOf = (loaded: unknown): BunEngineModule | undefined =>
  isEngineModule(loaded) ? loaded : undefined;

/** Both peers are the application's, and the engine is absent wherever Bun is not the runtime. */
const loadKit = async (): Promise<Kit | undefined> => {
  const [io, engine] = await Promise.all([
    loadPeer('socket.io'),
    typeof Bun === 'undefined' ? undefined : loadPeer('@socket.io/bun-engine'),
  ]);
  const Server: unknown =
    typeof io === 'object' && io !== null ? Reflect.get(io, 'Server') : undefined;
  if (!isServerClass(Server)) return undefined;
  return { Server, engine: engineOf(engine) };
};

export { loadKit };
export type { BunEngine, BunEngineModule, BunEngineOptions, Kit };

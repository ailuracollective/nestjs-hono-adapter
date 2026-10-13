/**
 * The WebSocket entry point, kept out of the root module so a
 * deployment that only serves HTTP never resolves
 * `@nestjs/websockets`: it is an optional peer, and it is not
 * needed to run the HTTP adapter.
 *
 * It ships as `@ailura/nestjs-platform-hono-ws` rather than
 * re-exported from the core's `index.ts`, because an ESM
 * re-export resolves eagerly and the core would load them
 * anyway.
 */
export { HonoWsAdapter } from './adapter.ts';
export type { HonoGatewayOptions } from './server.ts';
export type {
  HonoSocket,
  HonoWsAdapterOptions,
  MessageParser,
} from './client.ts';

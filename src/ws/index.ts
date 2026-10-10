/**
 * The WebSocket entry point, kept out of the root module so a
 * deployment that only serves HTTP never resolves
 * `@nestjs/websockets`: it is an optional peer, and it is not
 * needed to run the HTTP adapter.
 *
 * It is published as the `@ailura/nestjs-hono-adapter/ws`
 * subpath rather than re-exported from `index.ts`, because an
 * ESM re-export resolves eagerly and would load them anyway.
 */
export { HonoWsAdapter } from './adapter.ts';
export type { HonoGatewayOptions } from './adapter.ts';
export type { HonoSocket } from './client.ts';

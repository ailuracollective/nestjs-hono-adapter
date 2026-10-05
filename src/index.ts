/**
 * The public surface of the adapter: the class a bootstrap
 * hands to `NestFactory.create`, the options it and
 * `enableCors` accept, and the types a handler or a middleware
 * needs to describe what it touches.
 */
export { ServerAdapter } from './core/server-adapter.ts';
export type { ParsedBody } from './core/body.ts';
export type {
  NestHandler,
  NestRequest,
  NextHandler,
  TrustProxy,
} from './core/request.ts';
export type {
  NestContext,
  NestHono,
  NodeEnv,
} from './core/context.ts';
export type { CorsOptions } from './features/cors-middleware.ts';
export type { ParsedQuery } from './core/query.ts';
export type { StaticAssetsOptions } from './features/static-assets.ts';
export type {
  ViewData,
  ViewEngine,
  ViewOptions,
} from './features/views.ts';
export type {
  SecurityHook,
  ServerAdapterOptions,
} from './core/server-adapter.ts';

/**
 * The public surface of the adapter: the class a bootstrap
 * hands to `NestFactory.create`, the options it and
 * `enableCors` accept, and the types a handler or a middleware
 * needs to describe what it touches.
 */
export { ServerAdapter } from './core/server-adapter.ts';
export type {
  Bindings,
  Incoming,
  Socket,
  SocketAddress,
} from './core/bindings.ts';
export type { Address, Server } from './core/server.ts';
export type {
  ServerOptions,
  StaticOptions,
  Transport,
  WebSocketEvents,
  WebSocketFactory,
  WebSocketSupport,
} from './core/transport.ts';
export type { NestHonoApplication } from './core/application.ts';
export type {
  InjectCookie,
  InjectOptions,
  InjectResponse,
} from './core/inject.ts';
export type {
  BodyParserOptions,
  ParsedBody,
  SecurityHook,
} from './core/body.ts';
export type {
  NestHandler,
  NestRequest,
  NextHandler,
  TrustProxy,
} from './core/request.ts';

/**
 * Marks an adapter whose `multipart/form-data` bodies a
 * capability package consumes. It is public because the upload
 * package lives outside this one and has to reach the seam;
 * nothing else needs it, and an adapter nothing marks carries
 * no trace of an upload.
 */
export { declareMultipart } from './core/multipart.ts';
export type {
  NestEnv,
  NestContext,
  NestHono,
  /**
   * The environment `@hono/node-server` attaches, kept under
   * the name this package published it with.
   */
  NodeEnv,
} from './core/context.ts';
export type {
  CorsConfig,
  CorsOptions,
} from './features/cors-middleware.ts';
export type { ParsedQuery } from './core/query.ts';
export type { StaticAssetsOptions } from './features/static-assets.ts';
export type {
  EngineConfig,
  ViewData,
  ViewEngine,
  ViewEngineOptions,
  ViewOptions,
} from './features/views.ts';
export type { ServerAdapterOptions } from './core/server-adapter.ts';

/**
 * Where the `alias` entries in `wrangler.jsonc` point: a module
 * with nothing in it, for the packages this Worker never asks
 * for.
 *
 * Nest names nine of them, every one an optional peer that is
 * not installed here, and every one inside a lazy `import()`
 * that a bundler resolves while it builds — whether or not the
 * branch around it is ever taken:
 *
 * - `@nestjs/platform-express`, the HTTP platform, loaded by
 *   `NestFactory` when no adapter is passed, and this Worker
 *   passes one;
 * - `@nestjs/platform-socket.io`, the WebSocket platform;
 * - `class-validator` and `class-transformer`, what
 *   `ValidationPipe` and `ClassSerializerInterceptor` reach
 *   for when they are used;
 * - `ioredis`, `kafkajs`, `mqtt`, `amqp-connection-manager` and
 *   `@nats-io/transport-node`, the microservice transports.
 *
 * Installing them instead would bundle each one whole — express,
 * eight clients, and what they drag in with them — into a Worker
 * that reaches for none of them. `alias` is what wrangler
 * documents for exactly this, and it needs a module to point at.
 *
 * Nothing here runs. A lazy path that did run would find nothing
 * to read and fail where it is used, rather than the build
 * having failed over a package that was never installed.
 *
 * The export is what makes the file a module to every tool that
 * reads it.
 */
export const optionalPeerStub = true;

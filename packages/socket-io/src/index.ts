/**
 * The socket.io island: an `AbstractWsAdapter` that runs a Nest
 * gateway on socket.io, reached through `./socket-io`.
 *
 * It is the counterpart of `@nestjs/platform-socket.io`'s
 * `IoAdapter`, and it is a world of its own, like `./ws` and
 * `./multipart`: its modules import nothing from
 * `packages/core/src/core/` or `packages/core/src/features/` at
 * all, at runtime or as a type, so the whole island is
 * `socket.io` and the code in this directory.
 *
 * Socket.io is an optional peer dependency: it is only reached
 * when this subpath is imported.
 */
export { HonoIoAdapter } from './adapter.ts';
export type { IoOptions } from './adapter.ts';

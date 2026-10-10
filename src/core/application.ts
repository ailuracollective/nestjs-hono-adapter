/**
 * The types a consumer reads the application through: the one
 * to hand to `NestFactory.create()`, and the member that has to
 * be declared on Nest's own contract for the Hono application
 * to be reachable out of `getHttpAdapter()` at all.
 *
 * Nothing here runs — every import is `import type` — which is
 * what keeps this package's bundle unaffected by them: the
 * runtime graph of `.` never reaches this module.
 */
import type { Server as NativeServer } from 'node:http';
import type { INestApplication } from '@nestjs/common';

import type { Server } from './server.ts';
import type { NestHono } from './context.ts';
import type { ServerAdapter } from './server-adapter.ts';

/**
 * The application `NestFactory.create()` hands back with this
 * adapter. Nest types that call as `INestApplication`, whose
 * `getHttpAdapter()` answers the contract every platform
 * shares, so reaching Hono takes a cast — and naming this type
 * is the way around it:
 *
 * ```ts
 * const app =
 *   await NestFactory.create<NestHonoApplication>(
 *     AppModule,
 *     new ServerAdapter(),
 *   );
 * app.getHttpAdapter().getHono();
 * ```
 *
 * It is an interface rather than a class because this package
 * never constructs it, and it stays assignable to
 * `INestApplication`, so a function that took one keeps taking
 * this.
 *
 * The server is named as both the port every transport
 * implements and Node's own `http.Server`, which is the object
 * `getHttpServer()` answered before the transports split: a
 * `closeAllConnections()` or an `'upgrade'` listener keeps
 * compiling. Only the default (Node) transport hands back an
 * actual `http.Server`; the Bun and fetch transports answer the
 * port and leave the rest of the intersection unimplemented.
 */
interface NestHonoApplication extends INestApplication<
  Server & NativeServer
> {
  /**
   * The adapter itself, rather than the shared contract — so
   * `getHono()` and `useBodyParser()` are reachable without a
   * cast.
   */
  getHttpAdapter: () => ServerAdapter;
}

declare module '@nestjs/common' {
  /**
   * The one member this adapter adds to the shared contract, so
   * `app.getHttpAdapter().getHono()` needs no named type first.
   * This is a wider claim than narrowing the adapter would be:
   * it is now declared for the Express and Fastify adapters
   * too, which do not have it. `NestHonoApplication` is the
   * honest form and is what a program holding more than one
   * platform should name.
   */
  interface HttpServer<TRequest, TResponse, ServerInstance> {
    /** The Hono application behind this adapter. */
    getHono: () => NestHono;
  }
}

export type { NestHonoApplication };

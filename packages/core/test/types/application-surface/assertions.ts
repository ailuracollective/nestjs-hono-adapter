import type { Server as NodeHttpServer } from 'node:http';

import type {
  HttpServer,
  INestApplication,
} from '@nestjs/common';

import type {
  NestHonoApplication,
  Server,
  ServerAdapter,
} from '#adapter/index';

import type { Assert, AssignsTo, Same } from './helpers.ts';

/** The adapter stands in where an `HttpServer` is asked for. */
type TheAdapterIsTheContractItDeclares = Assert<
  AssignsTo<ServerAdapter, HttpServer>
>;

/** The application type is also an `INestApplication`. */
type TheApplicationIsAnINestApplication = Assert<
  AssignsTo<NestHonoApplication, INestApplication>
>;

/** The server is the port every transport implements. */
type TheServerIsTheAdapterServer = Assert<
  AssignsTo<
    ReturnType<NestHonoApplication['getHttpServer']>,
    Server
  >
>;

/** The server keeps Node's own `http.Server` surface. */
type TheServerKeepsTheNodeSurface = Assert<
  AssignsTo<
    ReturnType<NestHonoApplication['getHttpServer']>,
    NodeHttpServer
  >
>;

/** The adapter behind the application is this package's class. */
type TheAdapterBehindTheApplicationIsThisOne = Assert<
  Same<
    ReturnType<NestHonoApplication['getHttpAdapter']>,
    ServerAdapter
  >
>;

/** `getInstance()` keeps the escape hatch Nest declares. */
const readsAnyOtherInstance = (
  adapter: ServerAdapter,
): unknown => adapter.getInstance<unknown>();

export { readsAnyOtherInstance };
export type {
  TheAdapterBehindTheApplicationIsThisOne,
  TheAdapterIsTheContractItDeclares,
  TheApplicationIsAnINestApplication,
  TheServerIsTheAdapterServer,
  TheServerKeepsTheNodeSurface,
};

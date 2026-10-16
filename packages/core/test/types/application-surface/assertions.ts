import type { Server as NodeHttpServer } from 'node:http';

import type { HttpServer, INestApplication } from '@nestjs/common';

import type { NestHonoApplication, Server, ServerAdapter } from '#adapter/index';

import type { Assert, AssignsTo, Same } from './helpers.ts';

type TheAdapterIsTheContractItDeclares = Assert<AssignsTo<ServerAdapter, HttpServer>>;

type TheApplicationIsAnINestApplication = Assert<AssignsTo<NestHonoApplication, INestApplication>>;

type TheServerIsTheAdapterServer = Assert<
  AssignsTo<ReturnType<NestHonoApplication['getHttpServer']>, Server>
>;

type TheServerKeepsTheNodeSurface = Assert<
  AssignsTo<ReturnType<NestHonoApplication['getHttpServer']>, NodeHttpServer>
>;

type TheAdapterBehindTheApplicationIsThisOne = Assert<
  Same<ReturnType<NestHonoApplication['getHttpAdapter']>, ServerAdapter>
>;

const readsAnyOtherInstance = (adapter: ServerAdapter): unknown => adapter.getInstance<unknown>();

export { readsAnyOtherInstance };
export type {
  TheAdapterBehindTheApplicationIsThisOne,
  TheAdapterIsTheContractItDeclares,
  TheApplicationIsAnINestApplication,
  TheServerIsTheAdapterServer,
  TheServerKeepsTheNodeSurface,
};

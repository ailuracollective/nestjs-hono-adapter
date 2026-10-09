/**
 * Holds the answers the adapter gives an application, to the
 * types a bootstrap reads them as.
 *
 * `NestFactory.create()` types what it hands back as whatever
 * the caller asks for, defaulting to `INestApplication` — which
 * says nothing about the adapter behind it. Nothing in the
 * library compares the two: a method that drifted back to
 * `string`, or an application type that stopped satisfying the
 * constraint Nest puts on it, would reach a release and only
 * fail in a consumer's build. This file is that comparison.
 *
 * Nothing here runs. `tsc -p test/tsconfig.json` reads the file
 * and a mismatch is a compilation error, so the file is named
 * so that `bun test` leaves it alone as well.
 */
import type { ServerType } from '@hono/node-server';
import type {
  HttpServer,
  INestApplication,
  Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type {
  NestHonoApplication,
  NestHono,
} from '../../src/index.ts';
import { ServerAdapter } from '../../src/index.ts';

/** Fails the build unless the type handed to it is `true`. */
type Assert<Condition extends true> = Condition;

/** True when a value of `Left` can stand in for a `Right`. */
type AssignsTo<Left, Right> = [Left] extends [Right]
  ? true
  : false;

/** True when neither type is wider than the other. */
type Same<Left, Right> =
  AssignsTo<Left, Right> extends true
    ? AssignsTo<Right, Left>
    : false;

/**
 * Every answer an application on this adapter gives, taken off
 * one `NestFactory.create()` really hands back.
 *
 * The declared return type is what does the checking: every
 * element has to be the type named there, so a member that went
 * back to `string` or to `any` fails this file rather than a
 * consumer's build. It is written as a bootstrap writes it —
 * `NestFactory.create<NestHonoApplication>()` — because being
 * accepted as that type argument is half of what is claimed,
 * and only a call says so.
 */
async function reads(
  module: Type<unknown>,
): Promise<
  readonly [
    NestHono,
    ServerType,
    'hono',
    NestHono,
    ServerAdapter,
  ]
> {
  const app = await NestFactory.create<NestHonoApplication>(
    module,
    new ServerAdapter(),
  );
  return [
    app.getHttpAdapter().getHono(),
    app.getHttpServer(),
    app.getHttpAdapter().getType(),
    app.getHttpAdapter().getInstance(),
    app.getHttpAdapter(),
  ];
}

/**
 * The same answers, off an application nobody named the type
 * of. This is the augmentation of `HttpServer` carrying
 * `getHono()`: the object Nest hands back is the one every
 * platform shares, and this is the member it adds.
 */
async function readsWithoutNamingTheType(
  module: Type<unknown>,
): Promise<readonly [NestHono, INestApplication]> {
  const app = await NestFactory.create(
    module,
    new ServerAdapter(),
  );
  return [app.getHttpAdapter().getHono(), app];
}

/**
 * The adapter is the `HttpServer` its own contract names, so a
 * value of this class can stand in wherever Nest asks for one.
 * Three members used to answer `void` where the contract
 * answers the adapter, which is what made this hold false and
 * forced every consumer through a cast.
 */
type TheAdapterIsTheContractItDeclares = Assert<
  AssignsTo<ServerAdapter, HttpServer>
>;

/**
 * The application type is a `NestFactory.create()` argument and
 * an `INestApplication` argument both, so a helper that took
 * one keeps taking this.
 */
type TheApplicationIsAnINestApplication = Assert<
  AssignsTo<NestHonoApplication, INestApplication>
>;

/** The native server is the one `@hono/node-server` builds. */
type TheServerIsTheNodeServer = Assert<
  Same<
    ReturnType<NestHonoApplication['getHttpServer']>,
    ServerType
  >
>;

/** The adapter behind the application is this package's class. */
type TheAdapterBehindTheApplicationIsThisOne = Assert<
  Same<
    ReturnType<NestHonoApplication['getHttpAdapter']>,
    ServerAdapter
  >
>;

/**
 * `getInstance()` keeps the escape hatch Nest declares on it: a
 * caller who names a type still gets one, so narrowing the
 * default to the Hono application cost the caller nothing.
 */
function readsAnyOtherInstance(
  adapter: ServerAdapter,
): unknown {
  return adapter.getInstance<unknown>();
}

export type {
  TheAdapterBehindTheApplicationIsThisOne,
  TheAdapterIsTheContractItDeclares,
  TheApplicationIsAnINestApplication,
  TheServerIsTheNodeServer,
};
export {
  reads,
  readsAnyOtherInstance,
  readsWithoutNamingTheType,
};

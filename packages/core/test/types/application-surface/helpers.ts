import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';

import type {
  NestHono,
  NestHonoApplication,
  Server,
  ServerAdapter,
} from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';

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

/** Every answer an application on this adapter gives. */
const reads = async (
  module: Type<unknown>,
): Promise<
  readonly [NestHono, Server, 'hono', NestHono, ServerAdapter]
> => {
  const app = await NestFactory.create<NestHonoApplication>(
    module,
    bunAdapter(),
  );
  return [
    app.getHttpAdapter().getHono(),
    app.getHttpServer(),
    app.getHttpAdapter().getType(),
    app.getHttpAdapter().getInstance(),
    app.getHttpAdapter(),
  ];
};

/** The same answers, off an unnamed application type. */
const readsWithoutNamingTheType = async (
  module: Type<unknown>,
): Promise<readonly [NestHono, INestApplication]> => {
  const app = await NestFactory.create(module, bunAdapter());
  return [app.getHttpAdapter().getHono(), app];
};

export { reads, readsWithoutNamingTheType };
export type { Assert, AssignsTo, Same };

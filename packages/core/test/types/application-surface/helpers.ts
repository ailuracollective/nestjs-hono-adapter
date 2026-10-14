import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';

import type { NestHono, NestHonoApplication, Server, ServerAdapter } from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';

type Assert<Condition extends true> = Condition;

type AssignsTo<Left, Right> = [Left] extends [Right] ? true : false;

type Same<Left, Right> = AssignsTo<Left, Right> extends true ? AssignsTo<Right, Left> : false;

const reads = async (
  module: Type<unknown>,
): Promise<readonly [NestHono, Server, 'hono', NestHono, ServerAdapter]> => {
  const app = await NestFactory.create<NestHonoApplication>(module, bunAdapter());
  return [
    app.getHttpAdapter().getHono(),
    app.getHttpServer(),
    app.getHttpAdapter().getType(),
    app.getHttpAdapter().getInstance(),
    app.getHttpAdapter(),
  ];
};

const readsWithoutNamingTheType = async (
  module: Type<unknown>,
): Promise<readonly [NestHono, INestApplication]> => {
  const app = await NestFactory.create(module, bunAdapter());
  return [app.getHttpAdapter().getHono(), app];
};

export { reads, readsWithoutNamingTheType };
export type { Assert, AssignsTo, Same };

import { afterAll, beforeAll } from 'bun:test';

import { NestFactory } from '@nestjs/core';

import { fetchServer } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';
import type { NestHonoApplication } from '#adapter/index';

import { InjectModule } from './fixture.ts';

const build = async (): Promise<NestHonoApplication> => {
  const created = await NestFactory.create<NestHonoApplication>(
    InjectModule,
    new ServerAdapter({ transport: fetchServer() }),
    { logger: false },
  );
  await created.init();
  return created;
};

const state: { started?: Promise<NestHonoApplication> } = {};

const app = (): Promise<NestHonoApplication> => {
  state.started ??= build();
  return state.started;
};

const registerApplication = (): void => {
  beforeAll(async () => {
    await app();
  });

  afterAll(() => {
    // The application is left open on purpose.
  });
};

export { app, registerApplication };

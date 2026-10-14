import { afterAll, beforeAll } from 'bun:test';

import { NestFactory } from '@nestjs/core';

import { fetchServer } from '#adapter/servers/fetch';
import { ServerAdapter } from '#adapter/index';
import type { NestHonoApplication } from '#adapter/index';

import { InjectModule } from './fixture.ts';

/** Builds the application under test without listening. */
const build = async (): Promise<NestHonoApplication> => {
  const created = await NestFactory.create<NestHonoApplication>(
    InjectModule,
    new ServerAdapter({ transport: fetchServer() }),
    { logger: false },
  );
  await created.init();
  return created;
};

/** The one application every case asks for. */
const state: { started?: Promise<NestHonoApplication> } = {};

/** The application, built on first ask. */
const app = (): Promise<NestHonoApplication> => {
  state.started ??= build();
  return state.started;
};

/** Wires the shared application into the cases of one file. */
const registerApplication = (): void => {
  beforeAll(async () => {
    await app();
  });

  afterAll(() => {
    // The application is left open on purpose.
  });
};

export { app, registerApplication };

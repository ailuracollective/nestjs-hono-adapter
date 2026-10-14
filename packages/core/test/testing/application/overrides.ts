import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';

import type { ServerAdapter } from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';

import {
  LOCALHOST,
  OpenGuard,
  RefusingGuard,
} from '#adapter-test/testing/fixture';
import type { Answered } from '#adapter-test/testing/fixture';

/** Compiles a module with its guard overridden. */
const withOverriddenGuard = async <Answer>(
  module: Type<unknown>,
  read: (application: INestApplication) => Promise<Answer>,
): Promise<Answer> => {
  const compiled = await Test.createTestingModule({
    imports: [module],
  })
    .overrideGuard(RefusingGuard)
    .useValue(new OpenGuard())
    .compile();

  const application = compiled.createNestApplication(
    bunAdapter(),
    {
      logger: false,
    },
  );
  try {
    await application.init();
    return await read(application);
  } finally {
    await application.close();
  }
};

/** Answers a request against a listening application. */
const overConnection = async (
  adapter: ServerAdapter,
): Promise<Answered> => {
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError(
      'the application is not listening on a port',
    );
  }
  const response = await fetch(
    `http://${LOCALHOST}:${address.port}/ping`,
  );
  return {
    status: response.status,
    text: await response.text(),
  };
};

export { overConnection, withOverriddenGuard };

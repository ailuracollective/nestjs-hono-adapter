import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';

import type { ServerAdapter } from '#adapter/index';
import { bunAdapter } from '#test/bun-adapter';

import type { Answered } from '#adapter-test/testing/fixture';

/** The adapter behind a started application. */
const adapterOf = (
  application: INestApplication,
): ServerAdapter =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter is that class; the base type Nest hands back simply does not say so.
  application.getHttpAdapter() as unknown as ServerAdapter;

/** Answers one request against a started application. */
const ask = async (
  application: INestApplication,
  path: string,
): Promise<Answered> => {
  const response = await adapterOf(application)
    .getHono()
    .request(path, { method: 'GET' });
  return {
    status: response.status,
    text: await response.text(),
  };
};

/** Compiles a module and runs the reader on it. */
const withApplication = async <Answer>(
  module: Type<unknown>,
  read: (application: INestApplication) => Promise<Answer>,
): Promise<Answer> => {
  const compiled = await Test.createTestingModule({
    imports: [module],
  }).compile();

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

export { adapterOf, ask, withApplication };

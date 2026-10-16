import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';

import type { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { bunAdapter } from '#test/bun-adapter';

import type { Answered } from '#compat-test/testing/fixture';

const adapterOf = (application: INestApplication): ServerAdapter =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter is that class; the base type Nest hands back simply does not say so.
  application.getHttpAdapter() as unknown as ServerAdapter;

const ask = async (application: INestApplication, path: string): Promise<Answered> => {
  const response = await adapterOf(application).getHono().request(path, { method: 'GET' });
  return {
    status: response.status,
    text: await response.text(),
  };
};

const withApplication = async <Answer>(
  module: Type<unknown>,
  read: (application: INestApplication) => Promise<Answer>,
): Promise<Answer> => {
  const compiled = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const application = compiled.createNestApplication(bunAdapter(), {
    logger: false,
  });
  try {
    await application.init();
    return await read(application);
  } finally {
    await application.close();
  }
};

export { adapterOf, ask, withApplication };

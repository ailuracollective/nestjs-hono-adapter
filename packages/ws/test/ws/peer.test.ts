import { expect, test } from 'bun:test';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { patchWsAdapter } from '#ws/patch';

@Module({})
class EmptyModule {}

const createOf = (): unknown => Reflect.get(WsAdapter.prototype, 'create');

test('a peer the runtime cannot resolve is served the class the bundler resolved', async () => {
  // The global override is off: the case must leave the process's web classes alone.
  const adapter = new ServerAdapter({ transport: nodeServer({ overrideGlobalObjects: false }) });
  const app = await NestFactory.create(EmptyModule, adapter, { logger: false });
  await app.init();
  const stock = createOf();
  await patchWsAdapter(
    {
      hono: adapter.getHono(),
      server: () => adapter.getHttpServer(),
      transport: adapter.getTransport(),
    },
    (): Promise<unknown> => Promise.resolve(),
  );
  expect(createOf()).not.toBe(stock);
  await app.close();
});

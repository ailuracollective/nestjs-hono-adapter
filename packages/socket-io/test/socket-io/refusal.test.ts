import { expect, test } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ServerAdapter } from '#adapter/index';
import { fetchServer } from '#adapter/servers/fetch';
import { HonoIoAdapter } from '#socket-io/index';
import { GatewayModule } from './gateways.ts';
import { ANY_PORT, LOCALHOST } from './support.ts';

const refusalOf = async (app: INestApplication): Promise<string> => {
  try {
    await app.listen(ANY_PORT, LOCALHOST);
  } catch (error) {
    return String(error);
  }
  return '';
};

test('a transport with no node server is refused by name', async () => {
  const adapter = new ServerAdapter({
    transport: fetchServer(),
  });
  const app = await NestFactory.create(GatewayModule, adapter, {
    logger: false,
  });
  app.useWebSocketAdapter(new HonoIoAdapter(app));
  const refusal = await refusalOf(app);
  expect(refusal).toMatch(/needs a Node http\.Server/u);
});

test('attachment without an HTTP server is refused', () => {
  const adapter = new HonoIoAdapter();
  expect(() => adapter.create(ANY_PORT)).toThrow(/needs a Node http\.Server/u);
});

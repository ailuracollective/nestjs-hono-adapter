import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { httpServerHandler } from 'cloudflare:node';

import { ServerAdapter } from '../../../src/index.ts';
import { AppModule } from './app.module.ts';

const PORT = 8787;

const adapter = new ServerAdapter({ trustProxy: true });
const app = await NestFactory.create(AppModule, adapter, {
  logger: ['error', 'warn'],
});

adapter.getHono().get('/debug-env', (context) =>
  context.json({
    hasIncoming: Boolean(context.env?.incoming),
    hasSocket: Boolean(context.env?.incoming?.socket),
    remoteAddress:
      context.env?.incoming?.socket?.remoteAddress ?? null,
  }),
);

await app.listen(PORT);

export default httpServerHandler({ port: PORT });

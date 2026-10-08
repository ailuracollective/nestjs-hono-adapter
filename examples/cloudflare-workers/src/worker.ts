import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { httpServerHandler } from 'cloudflare:node';

import { ServerAdapter } from '../../../src/index.ts';
import { AppModule } from './app.module.ts';

const PORT = 8787;

// `@hono/node-server` replaces the global `Response` with a lighter
// one unless it is told not to, and this platform refuses an answer
// that is not one of its own: it answers 1101 before the application
// sees the request. Turning the replacement off keeps the platform’s
// classes. It is a Workers-only concern — the lighter class is worth
// roughly a third of the CPU an answer costs — so the default stays.
const adapter = new ServerAdapter({
  overrideGlobalObjects: false,
  trustProxy: true,
});

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

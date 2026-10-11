import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import {
  ServerAdapter,
  type NestHonoApplication,
} from '@ailura/nestjs-hono-adapter';
import { bunServer } from '@ailura/nestjs-hono-adapter/servers/bun';
import { AppModule } from './app.module.ts';

/**
 * This pairing does not work, and the example is here to say so
 * precisely rather than to pretend.
 *
 * A Cloudflare Worker runs on `workerd`, not on Bun: there is no
 * `Bun` global at all. The Bun transport reaches for it through
 * `hono/bun`, whose `ssg.js` opens with
 *
 *     const { write } = Bun;
 *
 * at module scope. That is evaluated on import, so the Worker
 * never gets as far as `Bun.serve`, which the transport only
 * calls from `listen()` — the failure is earlier and louder than
 * the transport alone would suggest.
 *
 * The Worker still builds and uploads cleanly: the reference is a
 * bare identifier, so a bundler resolves it to nothing and emits a
 * `ReferenceError: Bun is not defined` the first time the module
 * is evaluated. `wrangler deploy` reports success; `wrangler dev`
 * answers
 *
 *     The Workers runtime failed to start.
 *
 * and every request gets nothing. Serve this application through
 * the fetch transport or the node transport instead — see
 * `examples/cloudflare/fetch` and `examples/cloudflare/node`.
 *
 * There is no guard here on purpose: the import above is the thing
 * that fails, so a check written after it could never run. The
 * work above is what this example is worth.
 */
const adapter = new ServerAdapter({
  transport: bunServer(),
  trustProxy: true,
});

const app = await NestFactory.create<NestHonoApplication>(
  AppModule,
  adapter,
  { logger: ['error', 'warn'] },
);

// The same document and reference the other two Workers serve.
const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Ailura NestJS + Hono (Cloudflare bun)')
    .setVersion('1.0')
    .build(),
);

adapter.getHono().get('/docs-json', (context) => context.json(document));

app.use(
  '/reference',
  apiReference({
    content: document,
    pageTitle: 'Ailura NestJS + Hono (Cloudflare bun)',
  }),
);

await app.listen(8787);

export default { fetch: () => new Response('unreachable') };
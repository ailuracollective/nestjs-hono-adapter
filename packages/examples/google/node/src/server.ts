import 'reflect-metadata';
// Import before creating the app: it patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

import { createApp } from '@ailura/examples-shared';
import { SharedAppModule } from '@ailura/examples-shared/app';
import { setupExamplesVite } from '@ailura/examples-shared/dev';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

process.env.INERTIA_HOST = 'google';

/** The port the revision listens on: Cloud Run names it in $PORT. */
const PORT = Number(process.env.PORT ?? 8080);

/** The adapter the Cloud Run revision serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer(),
  // Google's front end appends the client it saw to x-forwarded-for, so the last
  // entry is Google's and the first is whatever the client sent.
  trustProxy: 1,
  rawBody: true,
  bodyLimit: 1024,
});

/** The Nest application. */
const app = await createApp(adapter, SharedAppModule);

await setupExamplesVite(app);
await app.listen(PORT);

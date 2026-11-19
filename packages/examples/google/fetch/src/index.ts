import 'reflect-metadata';
// Import before creating the app: it patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

import { getRequestListener } from '@hono/node-server';

import { createApp } from '@ailura/examples-shared';
import { SharedAppModule } from '@ailura/examples-shared/app';
import { setupExamplesVite } from '@ailura/examples-shared/dev';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchHandler, fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

process.env.INERTIA_HOST = 'google';

/** The adapter the Cloud Function serves through. */
const adapter = new ServerAdapter({
  transport: fetchServer(),
  // Google's front end appends the client it saw to x-forwarded-for, so the last
  // entry is Google's and the first is whatever the client sent.
  trustProxy: 1,
  rawBody: true,
  bodyLimit: 1024,
});

/** The Nest application. */
const app = await createApp(adapter, SharedAppModule);

await setupExamplesVite(app);
await app.init();

/** The Node handler the Functions Framework invokes, over the fetch handler. */
const handler = getRequestListener(fetchHandler(adapter.getHono()));

export { handler };

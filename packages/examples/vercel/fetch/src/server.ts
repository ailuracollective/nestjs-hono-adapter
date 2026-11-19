import 'reflect-metadata';
// Import before creating the app: it patches the stock Inertia module for Hono.
import '@ailura/nestjs-platform-hono-inertia/register';

// The NestJS preset picks its entrypoint by matching this specifier; the app is created by the
// shared package, so the import is type-only and disappears before the Function runs.
import type { NestApplication } from '@nestjs/core';

import { createApp } from '@ailura/examples-shared';
import { SharedAppModule } from '@ailura/examples-shared/app';
import { setupExamplesVite } from '@ailura/examples-shared/dev';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import {
  fetchHandler,
  fetchServer,
} from '@ailura/nestjs-hono-adapter/fetch';

process.env.INERTIA_HOST = 'vercel';

/** The adapter the Vercel Function serves through. */
const adapter = new ServerAdapter({
  transport: fetchServer(),
  // Vercel overwrites x-forwarded-for on every request, so the one hop in
  // front of the application is trusted and the address it names is the client.
  trustProxy: true,
  rawBody: true,
  bodyLimit: 1024,
});

/** The Nest application. */
const app = await createApp(adapter, SharedAppModule);

await setupExamplesVite(app);
await app.init();

/** Serves the Hono application through the fetch export Vercel detects. */
export default { fetch: fetchHandler(adapter.getHono()) };

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
import { nodeServer } from '@ailura/nestjs-hono-adapter/node-server';

process.env.INERTIA_HOST = 'vercel';

/** The port the server listens on: Vercel routes into it, it opens none. */
const PORT = Number(process.env.PORT ?? 3000);

/** The adapter the Vercel Function serves through. */
const adapter = new ServerAdapter({
  transport: nodeServer({ overrideGlobalObjects: false }),
  // Vercel overwrites x-forwarded-for on every request, so the one hop in
  // front of the application is trusted and the address it names is the client.
  trustProxy: true,
  rawBody: true,
  bodyLimit: 1024,
});

/** The Nest application. */
const app = await createApp(adapter, SharedAppModule);

await setupExamplesVite(app);

/** Vercel captures the `http.Server` this opens — the listen call is what it detects — and re-listens on a port it proxies to, so the promise it never settles is left pending. */
void app.listen(PORT);

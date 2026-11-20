import { join } from 'node:path';

import { setupInertiaVite } from '@dudousxd/nestjs-inertia-vite';

import type { NestHonoApplication } from '@ailura/nestjs-hono-adapter';

import { deployed, sharedRoot, shimmed } from './options.ts';

/** Vite's Connect middleware serves HMR in development; production skips it. */
const setupExamplesVite = async (app: NestHonoApplication): Promise<void> => {
  if (shimmed() || deployed()) return;
  const root = sharedRoot();
  await setupInertiaVite(app, {
    mode: process.env.NODE_ENV,
    configFile: join(root, 'vite.config.ts'),
    outDir: join(root, 'dist/inertia'),
    publicDir: join(root, 'inertia/public'),
    root,
  });
};

export { setupExamplesVite };

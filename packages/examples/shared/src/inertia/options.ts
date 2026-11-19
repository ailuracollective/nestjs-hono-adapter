import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { InertiaModuleOptions } from "@dudousxd/nestjs-inertia";


import { ROOT_VIEW } from '../inertia.generated.ts';

/** The package root, whether this runs from `src` or from `dist`. */
const sharedRoot = (): string => resolve(import.meta.dirname, '../..');

/** A Function ships only what it imports, so production reads the inlined build, not a file. */
const deployed = (): boolean =>
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.INERTIA_DEPLOYED === '1' ||
  process.env.K_SERVICE !== undefined ||
  process.env.NODE_ENV === 'production';

/** A Worker answers the renderer through its `fs` shim instead of a temp file. */
const shimmed = (): boolean => process.env.INERTIA_SHELL === 'shim';

/** The shell is a path, and a Function carries no file beside the bundle, so write it first. */
const shellFile = (): string => {
  const file = join(process.env.TMPDIR ?? '/tmp', 'ailura-inertia', 'root.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, ROOT_VIEW);
  return file;
};

/** What `InertiaModule.forRoot` receives, from the documented path form. */
const inertiaOptions = (): InertiaModuleOptions => {
  if (shimmed()) return { rootView: 'root.html', version: 'v1' };
  if (deployed()) return { rootView: shellFile(), version: 'v1' };
  return {
    rootView: resolve(sharedRoot(), 'inertia/root.html'),
    vite: { entry: 'inertia/app.tsx' },
    version: 'v1',
  };
};

export { deployed, inertiaOptions, sharedRoot, shimmed };

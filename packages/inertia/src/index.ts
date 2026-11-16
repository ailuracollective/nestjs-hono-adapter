import {
  InertiaMiddleware,
  InertiaModule,
  MethodSpoofMiddleware,
  RedirectInterceptor,
  VERSION,
} from '@dudousxd/nestjs-inertia';

import { patchInertiaModule } from './patch-module.ts';
import { patchRedirectInterceptor } from './patch-redirect.ts';
import { supportsInertia } from './version.ts';

// The module's `configure()` runs before the adapter's `init()` settles discovery, so the patch
// has to be in place as soon as this package is evaluated.
if (supportsInertia(VERSION)) {
  patchInertiaModule({ InertiaMiddleware, InertiaModule, MethodSpoofMiddleware });
  patchRedirectInterceptor({ RedirectInterceptor });
}

export { bridge } from './bridge.ts';

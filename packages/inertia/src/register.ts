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

// Import this before creating the Nest application: `InertiaModule.configure()` runs before the
// adapter's async bridge discovery settles.
if (supportsInertia(VERSION)) {
  patchInertiaModule({ InertiaMiddleware, InertiaModule, MethodSpoofMiddleware });
  patchRedirectInterceptor({ RedirectInterceptor });
}

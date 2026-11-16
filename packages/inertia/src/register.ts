import {
  InertiaMiddleware,
  InertiaModule,
  InertiaService,
  InertiaValidationFilter,
  MethodSpoofMiddleware,
  RedirectInterceptor,
  VERSION,
} from '@dudousxd/nestjs-inertia';

import { patchInertiaMiddleware } from './patch-middleware.ts';
import { patchInertiaModule } from './patch-module.ts';
import { patchInertiaService } from './patch-service.ts';
import { patchRedirectInterceptor } from './patch-redirect.ts';
import { patchValidationFilter } from './patch-validation.ts';
import { supportsInertia } from './version.ts';

// Import this before creating the Nest application: `InertiaModule.configure()` runs before the
// adapter's async bridge discovery settles.
if (supportsInertia(VERSION)) {
  patchInertiaMiddleware({ InertiaMiddleware });
  patchInertiaModule({ InertiaMiddleware, InertiaModule, MethodSpoofMiddleware });
  patchInertiaService({ InertiaService });
  patchRedirectInterceptor({ RedirectInterceptor });
  patchValidationFilter({ InertiaValidationFilter });
}

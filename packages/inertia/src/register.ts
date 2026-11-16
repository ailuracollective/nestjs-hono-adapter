import {
  InertiaMiddleware,
  InertiaModule,
  InertiaService,
  InertiaValidationFilter,
  MethodSpoofMiddleware,
  RedirectInterceptor,
  VERSION,
} from '@dudousxd/nestjs-inertia';

import { patchCookies } from './cookies.ts';
import { patchInertiaModule } from './module.ts';
import { patchRedirectInterceptor } from './redirect-interceptor.ts';
import { patchValidationFilter } from './validation-filter.ts';
import { patchVersionMismatch } from './version-mismatch.ts';
import { supportsInertia } from './version.ts';

// Import this before creating the Nest application: `InertiaModule.configure()` runs before the
// adapter's async bridge discovery settles.
if (supportsInertia(VERSION)) {
  patchCookies({ InertiaMiddleware });
  patchInertiaModule({ InertiaMiddleware, InertiaModule, MethodSpoofMiddleware });
  patchVersionMismatch({ InertiaService });
  patchRedirectInterceptor({ RedirectInterceptor });
  patchValidationFilter({ InertiaValidationFilter });
}

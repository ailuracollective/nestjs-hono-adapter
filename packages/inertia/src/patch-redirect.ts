import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { headerOf, isHono, methodOf, patchHonoRedirect } from './redirect-shape.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.redirect');

const SAFE_METHODS = new Set(['PUT', 'PATCH', 'DELETE', 'QUERY']);
const FOUND = 302;
const SEE_OTHER = 303;

interface InterceptorPrototype {
  intercept: (context: ExecutionContext, next: CallHandler) => Observable<unknown>;
}

interface RedirectPeer {
  readonly RedirectInterceptor: { readonly prototype: InterceptorPrototype };
}

/**
 * The stock interceptor patches `res.redirect` with Express's `(status, url)` shape. On Hono the
 * same call is `(url, status)`, so an explicit 301 would become 303. Patch only the Hono branch.
 */
const patchRedirectInterceptor = (peer: RedirectPeer): void => {
  const { prototype } = peer.RedirectInterceptor;
  if (Reflect.get(prototype, PATCHED) === true) return;
  Reflect.set(prototype, PATCHED, true);

  const { intercept: original } = prototype;
  prototype.intercept = function intercept(
    this: object,
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<unknown>();
    const res = context.switchToHttp().getResponse<unknown>();
    const options: unknown = Reflect.get(this, 'options');
    const autoUpgrade: unknown =
      typeof options === 'object' && options !== null
        ? Reflect.get(options, 'autoUpgrade303')
        : undefined;
    if (autoUpgrade === false || !isHono(res)) {
      return original.call(this, context, next);
    }
    if (!SAFE_METHODS.has(methodOf(req)) || headerOf(req, 'X-Inertia') === undefined) {
      return next.handle();
    }
    patchHonoRedirect(res);
    return next.handle().pipe(
      tap(() => {
        if (res.statusCode === FOUND) res.statusCode = SEE_OTHER;
      }),
    );
  };
};

export { patchRedirectInterceptor };

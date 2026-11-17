import type { BridgeTarget, NestContext } from '@ailura/nestjs-hono-adapter';

import { absoluteUrl, fragmentResponse, isInertia, isPrefetch, varyOn } from './redirect-target.ts';
import { MOUNTED } from './symbols.ts';

const FITTED = Symbol.for('ailura.nestjs-hono-inertia.surface');
const STATUS = Symbol.for('ailura.nestjs-hono-inertia.status');

const OK = 200;
const FOUND = 302;

const statusOf = (context: NestContext): number | undefined => {
  const value: unknown = Reflect.get(context, STATUS);
  return typeof value === 'number' ? value : undefined;
};

const fitRedirect = (context: NestContext): void => {
  const honoRedirect = context.redirect.bind(context);
  const redirect = (statusOrUrl: number | string, url?: string | number): Response => {
    const location = typeof statusOrUrl === 'number' ? String(url) : statusOrUrl;
    let status = FOUND;
    if (typeof statusOrUrl === 'number') status = statusOrUrl;
    else if (typeof url === 'number') status = url;
    varyOn(context);
    if (isInertia(context) && !isPrefetch(context) && location.includes('#')) {
      return fragmentResponse(context, absoluteUrl(context, location));
    }
    // The Hono helper narrows the status to `StatusCode`; Inertia passes the status it was given.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const response = honoRedirect(location, status as Parameters<typeof honoRedirect>[1]);
    context.res = response;
    return response;
  };
  Reflect.set(context, 'redirect', redirect);
};

const fit = (context: NestContext): void => {
  if (Reflect.get(context, FITTED) === true) return;
  Reflect.set(context, FITTED, true);

  Object.defineProperty(context, 'headersSent', {
    configurable: true,
    get: (): boolean => context.finalized,
  });
  Object.defineProperty(context, 'statusCode', {
    configurable: true,
    get: (): number => (context.finalized ? context.res.status : (statusOf(context) ?? OK)),
    set: (code: number): void => {
      Reflect.set(context, STATUS, code);
      if (context.finalized) {
        context.res = new Response(context.res.body, {
          headers: context.res.headers,
          status: code,
        });
      }
    },
  });
  fitRedirect(context);
  Reflect.set(context, 'end', (): void => {
    // `send` resolves the writer's pending status, which `res.status()` sets; a fresh `Response`
    // built here would read this file's own status symbol instead.
    const send: unknown = Reflect.get(context, 'send');
    if (typeof send === 'function') Reflect.apply(send, context, [undefined]);
  });
};

/**
 * The Inertia interceptors read Express members off the raw context; fit them before the route. The
 * middleware is installed for every Hono app the bridge reaches, but only an app that mounted the
 * Inertia module sets the marker, so other apps pay one symbol lookup per request.
 */
const fitSurface = (target: BridgeTarget): void => {
  target.hono.use('*', (context, next) => {
    if (Reflect.get(target.adapter, MOUNTED) === true) fit(context);
    return next();
  });
};

export { fitSurface };

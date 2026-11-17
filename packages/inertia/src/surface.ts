import type { BridgeTarget, NestContext } from '@ailura/nestjs-hono-adapter';

import { absoluteUrl, fragmentResponse, isInertia, isPrefetch, varyOn } from './redirect-target.ts';
import { MOUNTED } from './symbols.ts';

const FITTED = Symbol.for('ailura.nestjs-hono-inertia.surface');
const STATUS = Symbol.for('ailura.nestjs-hono-inertia.status');
const HONO_REDIRECT = Symbol.for('ailura.nestjs-hono-inertia.redirect');

const OK = 200;
const FOUND = 302;

const statusOf = (context: NestContext): number | undefined => {
  const value: unknown = Reflect.get(context, STATUS);
  return typeof value === 'number' ? value : undefined;
};

// Hoisted so a request allocates no closure: each member reads the context it is called on.
function headersSent(this: NestContext): boolean {
  return this.finalized;
}

function readStatusCode(this: NestContext): number {
  return this.finalized ? this.res.status : (statusOf(this) ?? OK);
}

function writeStatusCode(this: NestContext, code: number): void {
  Reflect.set(this, STATUS, code);
  if (this.finalized) {
    this.res = new Response(this.res.body, { headers: this.res.headers, status: code });
  }
}

type HonoRedirect = (this: NestContext, location: string, status?: number) => Response;

function redirect(
  this: NestContext,
  statusOrUrl: number | string,
  url?: string | number,
): Response {
  const location = typeof statusOrUrl === 'number' ? String(url) : statusOrUrl;
  let status = FOUND;
  if (typeof statusOrUrl === 'number') status = statusOrUrl;
  else if (typeof url === 'number') status = url;
  varyOn(this);
  if (isInertia(this) && !isPrefetch(this) && location.includes('#')) {
    return fragmentResponse(this, absoluteUrl(this, location));
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the captured Hono helper is the function fitted over.
  const honoRedirect = Reflect.get(this, HONO_REDIRECT) as HonoRedirect;
  const response = honoRedirect.call(this, location, status);
  this.res = response;
  return response;
}

function end(this: NestContext): void {
  // `send` resolves the writer's pending status; a fresh Response would read this file's symbol.
  const send: unknown = Reflect.get(this, 'send');
  if (typeof send === 'function') Reflect.apply(send, this, [undefined]);
}

const HEADERS_SENT: PropertyDescriptor = { configurable: true, get: headersSent };
const STATUS_CODE: PropertyDescriptor = {
  configurable: true,
  get: readStatusCode,
  set: writeStatusCode,
};

const fit = (context: NestContext): void => {
  if (Reflect.get(context, FITTED) === true) return;
  Reflect.set(context, FITTED, true);
  Reflect.set(context, HONO_REDIRECT, context.redirect);
  Object.defineProperty(context, 'headersSent', HEADERS_SENT);
  Object.defineProperty(context, 'statusCode', STATUS_CODE);
  Reflect.set(context, 'redirect', redirect);
  Reflect.set(context, 'end', end);
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

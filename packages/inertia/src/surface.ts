import { FITTED_END } from '@ailura/nestjs-hono-adapter';
import type { BridgeTarget, NestContext } from '@ailura/nestjs-hono-adapter';

import { absoluteUrl, fragmentResponse, isInertia, isPrefetch, varyOn } from './redirect-target.ts';
import { MOUNTED } from './symbols.ts';

const NO_CONTENT = 204;
const RESET_CONTENT = 205;
const NOT_MODIFIED = 304;

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
    const body =
      code === NO_CONTENT || code === RESET_CONTENT || code === NOT_MODIFIED
        ? undefined
        : this.res.body;
    this.res = new Response(body, { headers: this.res.headers, status: code });
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

function end(this: NestContext, body?: unknown): void {
  // `send` resolves the writer's pending status; a callback is `end`'s completion, not a body.
  const send: unknown = Reflect.get(this, 'send');
  if (typeof send === 'function') {
    Reflect.apply(send, this, [typeof body === 'function' ? undefined : body]);
  }
}
Reflect.set(end, FITTED_END, true);

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

// The Inertia interceptors read Express members off the raw context; fit them before the route.
// Other apps pay one symbol lookup per request because the module marker is unset.
const fitSurface = (target: BridgeTarget): void => {
  target.hono.use('*', (context, next) => {
    if (Reflect.get(target.adapter, MOUNTED) === true) fit(context);
    return next();
  });
};

export { fitSurface };

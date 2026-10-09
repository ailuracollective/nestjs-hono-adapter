import { promisify } from 'node:util';

import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import type { NestContext, NodeEnv } from '../core/context.ts';

/** The origins a deployment may allow. */
type AllowedOrigins =
  | boolean
  | string
  | RegExp
  | readonly (string | RegExp)[];

/**
 * The callback Nest's own options also allow, deciding an
 * origin per request. It is the shape the `cors` package takes,
 * and the bridge awaits its answer before the middleware runs.
 */
type OriginCallback = (
  requestOrigin: string | undefined,
  answer: OriginAnswer,
) => void;

/** What a callback reports back: an error, or what it allows. */
type OriginAnswer = (
  error?: Error | null,
  origin?: AllowedOrigins,
) => void;

/**
 * The CORS options the adapter honours, declared here because
 * Nest types the parameter as `any` on both the application and
 * the adapter, so nothing can be taken from a signature.
 * `optionsSuccessStatus` is accepted only when it names the
 * status a preflight is answered with, since the adapter
 * answers a preflight itself.
 */
interface CorsOptions {
  readonly allowedHeaders?: string | readonly string[];
  readonly credentials?: boolean;
  readonly exposedHeaders?: string | readonly string[];
  readonly maxAge?: number;
  readonly methods?: string | readonly string[];
  readonly optionsSuccessStatus?: number;
  readonly origin?: AllowedOrigins | OriginCallback;
  readonly preflightContinue?: boolean;
}

/** What a browser may call. */
const ALLOWED_METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
];

/**
 * The default a browser may reuse a preflight answer for: what
 * `@fastify/cors` answers with in the same case.
 */
const MAX_AGE_SECONDS = 86_400;

/**
 * The status a preflight is answered with; the middleware
 * always sends it.
 */
const PREFLIGHT_STATUS = 204;

const NO_HEADERS: readonly string[] = [];

function matchesRule(
  origin: string,
  rule: string | RegExp,
): boolean {
  if (rule instanceof RegExp) {
    return rule.test(origin);
  }

  return rule === origin;
}

function isAllowedOrigin(
  origin: string,
  allowed: AllowedOrigins | undefined,
): boolean {
  if (
    origin === '' ||
    allowed === false ||
    allowed === undefined
  ) {
    return false;
  }

  if (allowed === true) {
    return true;
  }

  if (typeof allowed === 'string') {
    return allowed === '*' || allowed === origin;
  }

  if (allowed instanceof RegExp) {
    return allowed.test(origin);
  }

  return allowed.some((candidate) =>
    matchesRule(origin, candidate),
  );
}

/**
 * Reads the origin a browser may call from: the origin itself
 * when it is allowed, and nothing when it is not. Nothing here
 * refuses a request either — CORS is a rule a browser follows,
 * and a service enforcing it would have to guess at callers
 * that are not browsers.
 */
function allowedOrigin(
  allowed: AllowedOrigins | undefined,
): (origin: string) => string | undefined {
  return (origin: string): string | undefined => {
    if (isAllowedOrigin(origin, allowed)) {
      return origin;
    }

    return undefined;
  };
}

/**
 * Reads a list Nest accepts as an array or as one
 * comma-separated string.
 */
function asList(
  value: string | readonly string[],
): readonly string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return value;
}

function headerList(
  value: string | readonly string[] | undefined,
  fallback: readonly string[],
): string[] {
  if (value === undefined) {
    return [...fallback];
  }

  return asList(value)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * The origin rules a middleware reads on its own; a callback
 * answers per request, which the bridge does before it runs.
 */
function staticOrigin(
  origin: AllowedOrigins | OriginCallback | undefined,
): AllowedOrigins | undefined {
  if (typeof origin === 'function') {
    return undefined;
  }

  return origin;
}

/**
 * Reads the origin a callback decides for one request. It
 * answers through a second argument rather than by returning,
 * so its answer is awaited here, and an error it reports is
 * thrown onto the path the exception layer already owns.
 */
function askOrigin(
  origin: OriginCallback,
  requestOrigin: string | undefined,
  answer: OriginAnswer,
): void {
  origin(requestOrigin, answer);
}

const askResolvedOrigin = promisify(askOrigin);

/**
 * The origin this request is allowed, or the configured value
 * itself when no callback decides it.
 */
function resolveOrigin(
  origin: AllowedOrigins | OriginCallback | undefined,
  requestOrigin: string | undefined,
): Promise<AllowedOrigins | undefined> {
  if (typeof origin !== 'function') {
    return Promise.resolve(origin);
  }

  return askResolvedOrigin(origin, requestOrigin);
}

/**
 * The origin rule the middleware is given: a `*` stays the
 * literal both platform adapters send, which also skips the
 * `Vary: Origin` an echo would need.
 */
function middlewareOrigin(
  named: AllowedOrigins | undefined,
): '*' | ((origin: string) => string | undefined) {
  if (named === '*') {
    return '*';
  }
  return allowedOrigin(named);
}

/**
 * Translates the options Nest was given into the middleware the
 * adapter runs; an origin a callback resolved for this request
 * is handed in, because the middleware reads the option once.
 * The headers a preflight may ask for default to none named,
 * which tells the middleware to reflect the
 * `Access-Control-Request- Headers` the request arrived with.
 * An answer status other than the one the middleware sends is
 * refused rather than ignored, since quietly doing something
 * other than what was asked is worse than failing at startup.
 */
function corsMiddleware(
  options: CorsOptions,
  resolved?: AllowedOrigins,
): MiddlewareHandler<NodeEnv> {
  const named = resolved ?? staticOrigin(options.origin);
  if (
    options.preflightContinue !== true &&
    options.optionsSuccessStatus !== undefined &&
    options.optionsSuccessStatus !== PREFLIGHT_STATUS
  ) {
    throw new TypeError(
      'The Hono adapter answers CORS preflight requests with ' +
        `${PREFLIGHT_STATUS}, so optionsSuccessStatus cannot ` +
        'name another status.',
    );
  }

  return cors({
    allowHeaders: headerList(
      options.allowedHeaders,
      NO_HEADERS,
    ),
    allowMethods: headerList(options.methods, ALLOWED_METHODS),
    credentials: options.credentials ?? false,
    exposeHeaders: headerList(
      options.exposedHeaders,
      NO_HEADERS,
    ),
    maxAge: options.maxAge ?? MAX_AGE_SECONDS,
    origin: middlewareOrigin(named),
  });
}

/** A step that ends the chain, for reading a preflight answer. */
const NOOP_NEXT = (): Promise<void> => Promise.resolve();

/** Says whether this request is a preflight the router answers. */
function isContinuedPreflight(
  options: CorsOptions,
  context: NestContext,
): boolean {
  return (
    options.preflightContinue === true &&
    context.req.method === 'OPTIONS'
  );
}

/**
 * Writes the headers a preflight would have carried, so the
 * request can travel on.
 */
async function forwardPreflight(
  context: NestContext,
  middleware: MiddlewareHandler<NodeEnv>,
): Promise<void> {
  const answer = await middleware(context, NOOP_NEXT);
  if (answer === undefined) {
    return;
  }

  for (const [name, value] of answer.headers) {
    context.header(name, value);
  }
}

/**
 * Runs CORS once a deployment has turned it on, and once the
 * origin for this request is known. The options are read when
 * the application is configured, which happens after the chain
 * it belongs to already exists, so the chain holds a step that
 * looks them up instead; a service that never enables CORS
 * simply continues and allows no origin. A preflight asked to
 * continue is written with its headers and then travels on,
 * which is what an application answering OPTIONS itself
 * expects.
 */
function corsBridge(
  handler: () => CorsOptions | undefined,
): MiddlewareHandler<NodeEnv> {
  return async (context, next) => {
    const options = handler();
    if (options === undefined) {
      return next();
    }

    const allowed = await resolveOrigin(
      options.origin,
      context.req.header('origin'),
    );
    const middleware = corsMiddleware(options, allowed);
    if (isContinuedPreflight(options, context)) {
      await forwardPreflight(context, middleware);
      return next();
    }

    return middleware(context, next);
  };
}

export { corsBridge };
export type { CorsOptions };

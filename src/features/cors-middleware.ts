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
 * The callback Nest's own options also allow, which decides an
 * origin per request. It is the same shape the `cors` package
 * takes, and the bridge awaits its answer before the middleware
 * runs.
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
 * The CORS options the adapter honours.
 *
 * They are declared here because Nest types the parameter as
 * `any` on both the application and the adapter, so nothing can
 * be taken from a signature. `optionsSuccessStatus` is accepted
 * only when it names the status a preflight is answered with,
 * because the middleware answers it the way the current
 * specification asks for; an application that continues a
 * preflight answers it itself, so the option says nothing
 * then.
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
 * How long a browser may reuse a preflight answer when the
 * deployment named no duration: the value `@fastify/cors`
 * answers with in the same case.
 */
const MAX_AGE_SECONDS = 86_400;

/**
 * The status a preflight is answered with. The specification
 * asks for no content, and the middleware always sends it.
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
 * when it is allowed, and nothing when it is not.
 *
 * Hono writes no header for nothing, and a browser that finds
 * no matching header keeps a foreign page from reading the
 * answer. Nothing here refuses a request either — CORS is a
 * rule a browser follows, and a service that enforced it would
 * have to guess at callers that are not browsers at all.
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
 * Reads a list that Nest accepts either as an array or as one
 * comma-separated string. The string form is what the platform
 * adapters are given, so both end up as the same list.
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
 * The origin rules a middleware reads on its own. A callback is
 * not one of them: it answers per request, which the bridge
 * does before the middleware runs.
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
 * Reads the origin a callback decides for one request.
 *
 * The callback answers through a second argument rather than by
 * returning, so its answer is awaited here. An error it reports
 * is thrown, which leaves the request on the path the exception
 * layer already owns.
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
 * The origin this request is allowed: the configured value
 * itself, unless a callback decides it per request, in which
 * case the callback is asked and its answer awaited.
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
 * The origin rule the middleware is given. A `*` stays the
 * literal both platform adapters send for it, which also skips
 * the `Vary: Origin` an echo would need; anything else is
 * decided per request.
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
 * adapter runs. An origin a callback resolved for this request
 * is handed in, because the middleware reads the option once.
 *
 * The headers a preflight may ask for default to none named,
 * which is how the middleware is told to reflect the
 * `Access-Control-Request-Headers` a request arrives with — the
 * default the platform adapters answer with.
 *
 * An answer status other than the one the middleware sends is
 * refused rather than ignored: the adapter answers a preflight
 * itself, and quietly doing something other than what was asked
 * is worse than failing at startup.
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
 * request can travel on to the route that answers it.
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
 * origin for this request is known.
 *
 * The options are read when the application is configured,
 * which happens after the chain it belongs to already exists,
 * so the chain holds a step that looks them up instead. A
 * service that never enables CORS simply continues, and no
 * origin is allowed because no header is ever written.
 *
 * A preflight asked to continue is written with its headers and
 * then travels on, which is what an application that answers
 * OPTIONS itself expects.
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

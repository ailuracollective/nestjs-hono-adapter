import type { BridgeAdapter, NestContext } from '@ailura/nestjs-hono-adapter';

const SAFE_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);

const DEFAULT_REDIRECT = 302;

const SEE_OTHER = 303;

interface ResponseFit {
  readonly adapter: BridgeAdapter;
  readonly context: NestContext;
  readonly nativeJson: NativeJson;
}

interface JsonOptions {
  readonly headers?: Record<string, string> | undefined;
  readonly statusOrSerialized?: number | string | undefined;
}

interface RedirectRequest {
  readonly statusOrUrl: number | string;
  readonly url?: number | string | undefined;
}

const isInertiaVisit = (context: NestContext): boolean =>
  SAFE_METHODS.has(context.req.method) && context.req.header('x-inertia') !== undefined;

const upgradedStatus = (context: NestContext, statusCode: number): number =>
  statusCode === DEFAULT_REDIRECT && isInertiaVisit(context) ? SEE_OTHER : statusCode;

const writeHeaders = (context: NestContext, headers?: Record<string, string>): void => {
  for (const [name, value] of Object.entries(headers ?? {})) context.header(name, value);
};

type NativeJson = (body: unknown, status?: number, headers?: Record<string, string>) => Response;

const sendJson = (fit: ResponseFit, body: unknown, options: JsonOptions): Response => {
  const { adapter, context, nativeJson } = fit;
  const { statusOrSerialized } = options;
  if (typeof statusOrSerialized !== 'string') {
    return nativeJson(body, statusOrSerialized, options.headers);
  }
  writeHeaders(context, options.headers);
  context.header('content-type', 'application/json');
  adapter.reply(context, statusOrSerialized);
  return context.res;
};

const redirectResponse = (fit: ResponseFit, request: RedirectRequest): Response => {
  const { statusOrUrl, url } = request;
  const statusCode = typeof statusOrUrl === 'number' ? statusOrUrl : (url ?? DEFAULT_REDIRECT);
  const location = typeof statusOrUrl === 'number' ? url : statusOrUrl;
  if (typeof location !== 'string') throw new TypeError('redirect() needs a location.');
  if (typeof statusCode !== 'number') throw new TypeError('redirect() needs a status code.');
  fit.adapter.redirect(fit.context, statusCode, location);
  return fit.context.res;
};

const restoreStatus = (context: NestContext, statusCode: number): void => {
  const { body, headers } = context.res;
  context.res = new Response(body, { headers, status: statusCode });
};

/**
 * The members `@dudousxd/nestjs-inertia` reads from an Express response, fitted on the request's
 * own Hono context. `json` and `redirect` keep Hono's own argument shapes as well.
 */
const fitResponse = (context: NestContext, adapter: BridgeAdapter): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Hono's `json` is typed with its status-code union; the fitted member takes a plain number.
  const nativeJson = context.json as unknown as NativeJson;
  const fit: ResponseFit = { adapter, context, nativeJson };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted surface layers the Inertia response dialect onto the Hono context.
  const target = context as unknown as Record<string, unknown>;
  target.json = (
    body: unknown,
    statusOrSerialized?: number | string,
    headers?: Record<string, string>,
  ): Response => sendJson(fit, body, { headers, statusOrSerialized });
  target.redirect = (statusOrUrl: number | string, url?: number | string): Response =>
    redirectResponse(fit, { statusOrUrl, url });
  Object.defineProperty(target, 'headersSent', {
    configurable: true,
    get: () => context.finalized,
  });
  Object.defineProperty(target, 'statusCode', {
    configurable: true,
    get: () => context.res.status,
    set: (statusCode: number) => {
      restoreStatus(context, statusCode);
    },
  });
};

export { fitResponse, upgradedStatus };

import type { NestContext } from '#adapter/core/context';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** The Express-shaped request a module reads. */
const expressRequest = (
  context: NestContext,
): Record<string, unknown> => {
  const headers: Record<string, string> = {};
  for (const [name, value] of context.req.raw.headers) {
    headers[name] = value;
  }
  const url = new URL(context.req.url);
  const query: Record<string, string> = {};
  for (const [name, value] of url.searchParams) {
    query[name] = value;
  }
  return {
    body: undefined,
    cookies: {},
    get: (name: string): string | undefined =>
      context.req.header(name),
    headers,
    method: context.req.method,
    originalUrl: context.req.url,
    params: {},
    path: url.pathname,
    query,
    url: context.req.url,
  };
};

/** The Express-shaped response a module writes through. */
const expressResponse = (
  context: NestContext,
): Record<string, unknown> => {
  const response: Record<string, unknown> = {
    getHeader: (name: string): string | null =>
      context.res.headers.get(name),
    headersSent: false,
    json: (body: unknown): Response => context.json(body),
    locals: {},
    send: (body: unknown): Response =>
      typeof body === 'string'
        ? context.text(body)
        : context.json(body),
    setHeader: (name: string, value: string): void => {
      context.header(name, value);
    },
    status: (
      code: ContentfulStatusCode,
    ): Record<string, unknown> => {
      response.statusCode = code;
      context.status(code);
      return response;
    },
    statusCode: 200,
  };
  return response;
};

export { expressRequest, expressResponse };

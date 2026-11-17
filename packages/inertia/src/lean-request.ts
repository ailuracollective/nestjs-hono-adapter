import type { NestRequest } from '@ailura/nestjs-hono-adapter';

const adaptRequest = (request: NestRequest): Record<string, unknown> => {
  const adapted: Record<string, unknown> = {
    header: (name: string): string | undefined => request.header(name),
    method: request.method,
    originalUrl: request.originalUrl,
    protocol: request.protocol,
    query: request.query,
    raw: request,
    url: request.url,
  };
  if (request.body !== undefined) adapted.body = request.body;
  return adapted;
};

export { adaptRequest };

import type { NestContext } from '@ailura/nestjs-hono-adapter';

const JSON_TYPE = 'application/json';

const GRAPHQL_TYPE = 'application/graphql';

const MULTIPART_TYPE = 'multipart/form-data';

const BODYLESS = new Set(['GET', 'HEAD']);

const NOTHING: Promise<unknown> = Promise.resolve();

const jsonBody = async (context: NestContext): Promise<unknown> => {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
};

const documentBody = (context: NestContext): Promise<unknown> => context.req.text();

const uploadBody = (context: NestContext): Promise<unknown> => context.req.parseBody();

const bodyOfType = (context: NestContext, type: string): Promise<unknown> => {
  if (type.includes(JSON_TYPE)) {
    return jsonBody(context);
  }
  if (type.includes(GRAPHQL_TYPE)) {
    return documentBody(context);
  }
  return type.includes(MULTIPART_TYPE) ? uploadBody(context) : NOTHING;
};

const readBody = (context: NestContext): Promise<unknown> => {
  const { method } = context.req;
  if (BODYLESS.has(method)) {
    return NOTHING;
  }
  return bodyOfType(context, context.req.header('content-type') ?? '');
};

export { readBody };

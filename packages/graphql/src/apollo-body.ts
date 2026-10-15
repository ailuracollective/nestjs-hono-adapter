import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { toNestRequest } from '@ailura/nestjs-hono-adapter';

const JSON_TYPE = 'application/json';

const GRAPHQL_TYPE = 'application/graphql';

const MULTIPART_TYPE = 'multipart/form-data';

const FORM_TYPE = 'application/x-www-form-urlencoded';

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

// Nest's Express adapter parses urlencoded bodies before Apollo sees them; the bridge builds the
// same object here, or the operation arrives empty ("POST body missing").
const formBody = async (context: NestContext): Promise<unknown> => {
  try {
    const text = await context.req.text();
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return undefined;
  }
};

const uploadBody = (context: NestContext): Promise<unknown> => context.req.parseBody();

const bodyOfType = (context: NestContext, type: string): Promise<unknown> => {
  if (type.includes(JSON_TYPE)) {
    return jsonBody(context);
  }
  if (type.includes(GRAPHQL_TYPE)) {
    return documentBody(context);
  }
  if (type.includes(FORM_TYPE)) {
    return formBody(context);
  }
  return type.includes(MULTIPART_TYPE) ? uploadBody(context) : NOTHING;
};

const readBody = (context: NestContext): Promise<unknown> => {
  const { method } = context.req;
  if (BODYLESS.has(method)) {
    return NOTHING;
  }
  // An Express middleware may have converted the body already — `graphqlUploadExpress` turns a
  // multipart request into a GraphQL one — and that is what Apollo is given.
  const carried = toNestRequest(context, { trustProxy: false }).body;
  if (carried !== undefined) return Promise.resolve(carried);
  return bodyOfType(context, context.req.header('content-type') ?? '');
};

export { readBody };

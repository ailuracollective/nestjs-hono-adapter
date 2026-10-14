import type { NestContext } from '@ailura/nestjs-hono-adapter';

/** The content type that carries a JSON GraphQL request. */
const JSON_TYPE = 'application/json';

/** The content type that carries a raw GraphQL document. */
const GRAPHQL_TYPE = 'application/graphql';

/** The content type that carries a GraphQL multipart upload. */
const MULTIPART_TYPE = 'multipart/form-data';

/** The methods that carry no request body. */
const BODYLESS = new Set(['GET', 'HEAD']);

/** What a request that names no readable body is answered with. */
const NOTHING: Promise<unknown> = Promise.resolve();

/** The JSON body, or nothing when it does not parse. */
const jsonBody = async (
  context: NestContext,
): Promise<unknown> => {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
};

/** The body of a content type that carries a raw document. */
const documentBody = (context: NestContext): Promise<unknown> =>
  context.req.text();

/** The body of a GraphQL multipart upload. */
const uploadBody = (context: NestContext): Promise<unknown> =>
  context.req.parseBody();

/**
 * The body a content type asks for, or nothing when it asks for
 * none.
 */
const bodyOfType = (
  context: NestContext,
  type: string,
): Promise<unknown> => {
  if (type.includes(JSON_TYPE)) {
    return jsonBody(context);
  }
  if (type.includes(GRAPHQL_TYPE)) {
    return documentBody(context);
  }
  return type.includes(MULTIPART_TYPE)
    ? uploadBody(context)
    : NOTHING;
};

/**
 * Reads the body Apollo expects for the request, off the same
 * body the adapter's own parser reads.
 */
const readBody = (context: NestContext): Promise<unknown> => {
  const { method } = context.req;
  if (BODYLESS.has(method)) {
    return NOTHING;
  }
  return bodyOfType(
    context,
    context.req.header('content-type') ?? '',
  );
};

export { readBody };

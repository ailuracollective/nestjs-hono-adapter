import type { NestContext } from '#adapter/core/context';
import { toResponse } from './builders.ts';
import { responseHeaders } from './headers.ts';

/** Builds the Web response for a value Nest returned. */
const buildResponse = (
  context: NestContext,
  body: unknown,
  status: number,
): Response => {
  const headers = responseHeaders(context);
  context.res = undefined;
  return toResponse(body, status, headers);
};

export { buildResponse };

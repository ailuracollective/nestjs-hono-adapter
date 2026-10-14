import type { NestContext } from '#adapter/core/context';
import { toResponse } from './builders.ts';
import { responseHeaders } from './headers.ts';

const buildResponse = (context: NestContext, body: unknown, status: number): Response => {
  const headers = responseHeaders(context);
  context.res = undefined;
  return toResponse(body, status, headers);
};

export { buildResponse };

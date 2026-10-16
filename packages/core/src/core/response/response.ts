import type { NestContext } from '#adapter/core/context';
import { toResponse } from './builders.ts';

const buildResponse = (context: NestContext, body: unknown, status: number): Response => {
  const { headers } = context.res;
  context.res = undefined;
  return toResponse(body, status, headers);
};

export { buildResponse };

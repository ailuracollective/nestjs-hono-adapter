import type { NestContext } from '#adapter/core/context';
import { nativeHttp1 } from '#adapter/core/request/body/guards';

import { toResponse } from './builders.ts';

const buildResponse = (context: NestContext, body: unknown, status: number): Response => {
  const { headers } = context.res;
  context.res = undefined;
  return toResponse(body, { direct: nativeHttp1(context.env), headers, status });
};

export { buildResponse };

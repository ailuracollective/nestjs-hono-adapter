import type { NestContext } from '#adapter/core/context';
import type { ResponseWriter } from '#adapter/core/response/response-writer';

import { fitResponse } from './surface.ts';

const fitted = new WeakSet<object>();

const installSurface = (context: NestContext, writer: ResponseWriter): void => {
  if (fitted.has(context)) return;
  fitted.add(context);
  fitResponse(context, writer);
};

export { installSurface };
export { middlewareResponse } from './middleware-response.ts';
export type { MiddlewareResponse } from './middleware-response.ts';

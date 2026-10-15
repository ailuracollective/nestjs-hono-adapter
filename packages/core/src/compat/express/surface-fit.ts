import type { NestContext } from '#adapter/core/context';

import { fitResponse, surface } from './surface.ts';

const fitted = new WeakSet<object>();

const installSurface = (context: NestContext): void => {
  const prototype: object | null = Reflect.getPrototypeOf(context);
  if (prototype !== null && !fitted.has(prototype)) {
    fitted.add(prototype);
    Object.assign(prototype, surface);
  }
  fitResponse(context);
};

export { installSurface };
export { middlewareResponse } from './middleware-response.ts';
export type { MiddlewareResponse } from './middleware-response.ts';

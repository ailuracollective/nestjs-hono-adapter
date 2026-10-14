import type { NestContext } from '#adapter/core/context';

import { surface } from './surface.ts';

const fitted = new WeakSet<object>();

const installSurface = (context: NestContext): void => {
  const prototype: object | null = Reflect.getPrototypeOf(context);
  if (prototype === null || fitted.has(prototype)) {
    return;
  }
  fitted.add(prototype);
  Object.assign(prototype, surface);
};

export { installSurface };

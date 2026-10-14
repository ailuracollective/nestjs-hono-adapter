import type { NestContext } from '#adapter/core/context';

import { surface } from './surface.ts';

/** The context prototypes already fitted. */
const fitted = new WeakSet<object>();

/**
 * Puts `type` and `send` on the context prototype, once per
 * application.
 */
const installSurface = (context: NestContext): void => {
  const prototype: object | null =
    Reflect.getPrototypeOf(context);
  if (prototype === null || fitted.has(prototype)) {
    return;
  }
  fitted.add(prototype);
  Object.assign(prototype, surface);
};

export { installSurface };

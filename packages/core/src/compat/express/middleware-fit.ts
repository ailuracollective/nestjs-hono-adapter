import type { NestHono } from '#adapter/core/context';

import { LAST, ONLY_HANDLER, isErrorMiddleware } from './middleware-shape.ts';
import { wrapExpressMiddleware } from './middleware-run.ts';

const fitted = new WeakSet<NestHono>();

const shim =
  (original: (...args: unknown[]) => unknown) =>
  (...args: unknown[]): unknown => {
    const last = args.at(LAST);
    if (!isErrorMiddleware(last)) {
      return original(...args);
    }
    const wrapped = wrapExpressMiddleware(last);
    if (args.length === ONLY_HANDLER) return original(wrapped);
    return original(...args.slice(0, LAST), wrapped);
  };

const installErrorMiddleware = (hono: NestHono): void => {
  if (fitted.has(hono)) {
    return;
  }
  fitted.add(hono);
  const original = hono.use.bind(hono) as (...args: unknown[]) => unknown;
  hono.use = shim(original) as typeof hono.use;
};

export { installErrorMiddleware };

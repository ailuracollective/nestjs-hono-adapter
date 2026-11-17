import type { NestContext, NestRequest } from '@ailura/nestjs-hono-adapter';
import type { Type } from '@nestjs/common';

import { cookieHeader, parseCookies } from './cookies.ts';
import type { RequestShape } from './cookies.ts';
import { adaptRequest } from './lean-request.ts';
import { adaptResponse } from './lean-response.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.lean-middleware');

interface InertiaPeer {
  readonly InertiaMiddleware: Type<unknown>;
  readonly InertiaService: Type<unknown>;
}

interface MiddlewareInstance {
  readonly deps?: unknown;
}

const defineLazyInertia = (request: NestRequest, create: () => unknown): void => {
  const settle = (value: unknown): void => {
    Object.defineProperty(request, 'inertia', {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  };
  Object.defineProperty(request, 'inertia', {
    configurable: true,
    enumerable: true,
    get(): unknown {
      const service = create();
      settle(service);
      return service;
    },
    set: settle,
  });
};

/**
 * The stock Express middleware patches six response methods per request (`suppressPostSendWrites`)
 * so Nest's post-handler cannot overwrite the render. The adapter already refuses that write once
 * the context is finalized (`adapter.ts`), and the fitted context carries every member the Inertia
 * service reads, so Hono mounts a middleware that only defines the lazy service and reads the
 * cookie it needs.
 */
const patchLeanMiddleware = (peer: InertiaPeer): void => {
  const prototype: unknown = Reflect.get(peer.InertiaMiddleware, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) return;
  if (Reflect.get(prototype, PATCHED) === true) return;
  Reflect.set(prototype, PATCHED, true);

  Reflect.set(
    prototype,
    'use',
    function use(this: MiddlewareInstance, ...args: [NestRequest, NestContext, () => void]): void {
      const [req, res, next] = args;
      const shape = req as NestRequest & RequestShape;
      shape.cookies ??= parseCookies(cookieHeader(shape));
      defineLazyInertia(req, () => {
        const request = adaptRequest(req);
        const response = adaptResponse(res);
        return new peer.InertiaService(request, response, this.deps);
      });
      next();
    },
  );
};

export { patchLeanMiddleware };
export type { InertiaPeer };

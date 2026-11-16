import { RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, Type } from '@nestjs/common';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.configure');

const EVERY_ROUTE = { method: RequestMethod.ALL, path: '*' } as const;

interface ModuleHost {
  readonly httpAdapterHost?: {
    readonly httpAdapter?: { getType: () => string };
  };
}

interface InertiaModulePrototype {
  configure: (this: ModuleHost, consumer: MiddlewareConsumer) => void;
}

interface InertiaPeer {
  readonly InertiaModule: Type<unknown>;
  readonly InertiaMiddleware: Type<unknown>;
  readonly MethodSpoofMiddleware: Type<unknown>;
}

const isPrototype = (value: unknown): value is InertiaModulePrototype =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'configure') === 'function';

const prototypeOf = (module: Type<unknown>): InertiaModulePrototype | undefined => {
  const prototype: unknown = Reflect.get(module, 'prototype');
  return isPrototype(prototype) ? prototype : undefined;
};

const platformOf = (host: ModuleHost): string | undefined => {
  const adapter = host.httpAdapterHost === undefined ? undefined : host.httpAdapterHost.httpAdapter;
  return adapter === undefined ? undefined : adapter.getType();
};

/**
 * `InertiaModule` registers its middleware only when `getType() === 'express'`, so on Hono
 * `req.inertia` never exists and `@Inertia()` throws. Register the same two middleware here.
 */
const patchInertiaModule = (peer: InertiaPeer): void => {
  const prototype = prototypeOf(peer.InertiaModule);
  if (prototype === undefined || Reflect.get(prototype, PATCHED) === true) return;

  const original: unknown = Reflect.get(prototype, 'configure');
  prototype.configure = function configure(this: ModuleHost, consumer: MiddlewareConsumer): void {
    if (platformOf(this) !== 'hono') {
      if (typeof original === 'function') Reflect.apply(original, this, [consumer]);
      return;
    }
    consumer.apply(peer.MethodSpoofMiddleware).forRoutes(EVERY_ROUTE);
    consumer.apply(peer.InertiaMiddleware).forRoutes(EVERY_ROUTE);
  };

  Reflect.set(prototype, PATCHED, true);
};

export { patchInertiaModule };
export type { InertiaPeer };

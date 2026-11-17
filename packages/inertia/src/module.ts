import { RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, Type } from '@nestjs/common';

import { MOUNTED } from './symbols.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.configure');

const EVERY_ROUTE = { method: RequestMethod.ALL, path: '*' } as const;

interface ModuleHost {
  readonly httpAdapterHost?: {
    readonly httpAdapter?: { getType: () => string };
  };
  readonly options?: unknown;
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
    const adapter =
      this.httpAdapterHost === undefined ? undefined : this.httpAdapterHost.httpAdapter;
    if (adapter !== undefined) Reflect.set(adapter, MOUNTED, true);
    // The stock middleware only spoofs when the option is on; mounting it otherwise costs a
    // middleware route on every request for a no-op.
    const options: unknown = Reflect.get(this, 'options');
    if (
      typeof options === 'object' &&
      options !== null &&
      Reflect.get(options, 'methodSpoofing') === true
    ) {
      consumer.apply(peer.MethodSpoofMiddleware).forRoutes(EVERY_ROUTE);
    }
    consumer.apply(peer.InertiaMiddleware).forRoutes(EVERY_ROUTE);
  };

  Reflect.set(prototype, PATCHED, true);
};

export { patchInertiaModule };
export type { InertiaPeer };

import { isHonoResponse } from './service-types.ts';
import type { InertiaServiceShape, ServicePeer } from './service-types.ts';
import { fullUrl } from './service-url.ts';

const PATCHED = Symbol.for('ailura.nestjs-hono-inertia.version-mismatch');

const CONFLICT = 409;

/**
 * The stock service answers a version mismatch with a relative `X-Inertia-Location` and no
 * `X-Inertia-Version`. Fit the control response the protocol specifies on Hono.
 */
const patchVersionMismatch = (peer: ServicePeer): void => {
  const prototype: unknown = Reflect.get(peer.InertiaService, 'prototype');
  if (typeof prototype !== 'object' || prototype === null) return;
  if (Reflect.get(prototype, PATCHED) === true) return;
  Reflect.set(prototype, PATCHED, true);

  const original: unknown = Reflect.get(prototype, 'render');
  if (typeof original !== 'function') return;
  Reflect.set(
    prototype,
    'render',
    async function render(
      this: InertiaServiceShape,
      component: string,
      props?: Record<string, unknown>,
    ): Promise<void> {
      if (isHonoResponse(this.res)) {
        const clientVersion = this.req.header('X-Inertia-Version') ?? '';
        if (
          this.req.method === 'GET' &&
          this.req.header('X-Inertia') !== undefined &&
          clientVersion !== this.deps.assetVersion
        ) {
          this.res
            .status(CONFLICT)
            .setHeader('X-Inertia-Location', fullUrl(this.req))
            .setHeader('X-Inertia-Version', this.deps.assetVersion)
            .end();
          return;
        }
      }
      await Reflect.apply(original, this, [component, props]);
    },
  );
};

export { patchVersionMismatch };

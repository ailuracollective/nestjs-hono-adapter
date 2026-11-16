import type { MiddlewareConsumer } from '@nestjs/common';
import { InertiaMiddleware, InertiaModule, MethodSpoofMiddleware } from '@dudousxd/nestjs-inertia';

const EVERY_ROUTE = '*';

interface AdapterCarrier {
  getType: () => string;
}

interface ConfigureCarrier {
  readonly httpAdapterHost: { readonly httpAdapter: AdapterCarrier };
  configure: (consumer: MiddlewareConsumer) => void;
}

const isHono = (carrier: ConfigureCarrier): boolean =>
  carrier.httpAdapterHost.httpAdapter.getType() === 'hono';

/**
 * The stock `configure()` mounts its middleware only for Express, so a Hono application never sees
 * `req.inertia`. This runs at package evaluation because Nest calls `configure()` before async
 * discovery settles.
 */
const patchConfigure = (): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the module's fields are private in its own typings, so its runtime shape is named here.
  const prototype = InertiaModule.prototype as unknown as ConfigureCarrier;
  const original = prototype.configure;
  prototype.configure = function configure(
    this: ConfigureCarrier,
    consumer: MiddlewareConsumer,
  ): void {
    if (!isHono(this)) {
      original.call(this, consumer);
      return;
    }
    consumer.apply(MethodSpoofMiddleware).forRoutes(EVERY_ROUTE);
    consumer.apply(InertiaMiddleware).forRoutes(EVERY_ROUTE);
  };
};

export { patchConfigure };

import type { ApolloPeer, DriverAdapter, DriverHost } from './peer-shapes.ts';

const isCarrier = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCallable = (value: unknown): value is (this: object) => unknown =>
  typeof value === 'function';

const hasMethod = (carrier: object, name: string): boolean =>
  isCallable(Reflect.get(carrier, name));

const isAdapter = (carrier: object): boolean =>
  hasMethod(carrier, 'getHono') && hasMethod(carrier, 'getType');

const call = (adapter: object, name: string): unknown => {
  const member: unknown = Reflect.get(adapter, name);
  return isCallable(member) ? Reflect.apply(member, adapter, []) : undefined;
};

const adapterOf = (driver: DriverHost): DriverAdapter | undefined => {
  const host = driver.httpAdapterHost;
  if (host === undefined) return undefined;
  const { httpAdapter } = host;
  if (!isCarrier(httpAdapter) || !isAdapter(httpAdapter)) {
    return undefined;
  }
  const adapter = httpAdapter;
  return {
    hono: (): unknown => call(adapter, 'getHono'),
    server: (): unknown => call(adapter, 'getHttpServer'),
    type: (): string => String(call(adapter, 'getType')),
  };
};

const isOnHono = (driver: DriverHost): boolean => {
  const adapter = adapterOf(driver);
  return adapter === undefined ? false : adapter.type() === 'hono';
};

const isApolloPeer = (loaded: unknown): loaded is ApolloPeer =>
  isCarrier(loaded) && 'ApolloDriver' in loaded;

export { adapterOf, isApolloPeer, isCarrier, isOnHono };

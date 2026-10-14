import type {
  ApolloPeer,
  DriverAdapter,
  DriverHost,
} from './peer-shapes.ts';

/** Whether a value is an object the bridge can read members off. */
const isCarrier = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Whether a value is callable with an adapter as its receiver. */
const isCallable = (
  value: unknown,
): value is (this: object) => unknown =>
  typeof value === 'function';

/** Whether a carrier carries a callable member by name. */
const hasMethod = (carrier: object, name: string): boolean =>
  isCallable(Reflect.get(carrier, name));

/** Whether a carrier carries both of the members a driver reads. */
const isAdapter = (carrier: object): boolean =>
  hasMethod(carrier, 'getHono') &&
  hasMethod(carrier, 'getType');

/**
 * Calls one member of the adapter, with the adapter as
 * receiver.
 */
const call = (adapter: object, name: string): unknown => {
  const member: unknown = Reflect.get(adapter, name);
  return isCallable(member)
    ? Reflect.apply(member, adapter, [])
    : undefined;
};

/**
 * The adapter Nest injected, when it is one this adapter
 * recognises.
 */
const adapterOf = (
  driver: DriverHost,
): DriverAdapter | undefined => {
  const host = driver.httpAdapterHost;
  if (host === undefined) {
    return undefined;
  }
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

/**
 * Whether the driver Nest is booting is running on this
 * adapter.
 */
const isOnHono = (driver: DriverHost): boolean => {
  const adapter = adapterOf(driver);
  return adapter === undefined
    ? false
    : adapter.type() === 'hono';
};

/** Whether a loaded module carries Apollo's driver. */
const isApolloPeer = (loaded: unknown): loaded is ApolloPeer =>
  isCarrier(loaded) && 'ApolloDriver' in loaded;

export { adapterOf, isApolloPeer, isCarrier, isOnHono };

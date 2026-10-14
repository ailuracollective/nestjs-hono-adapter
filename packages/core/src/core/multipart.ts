type MultipartRegistry = WeakSet<object>;

interface AdapterLike {
  getType: () => string;
}

const MULTIPART_KEY = Symbol.for('@ailura/nestjs-hono-adapter:multipart');

const CURRENT_ADAPTER_KEY = Symbol.for('@ailura/nestjs-hono-adapter:current-adapter');

const isAdapter = (value: unknown): value is AdapterLike =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getType') === 'function';

/**
 * Kept on `globalThis` so every copy of this module shares one registry: the mark must cross a
 * duplicated `@nestjs/core`.
 */
const registry = ((): MultipartRegistry => {
  const existing: unknown = Reflect.get(globalThis, MULTIPART_KEY);
  if (existing instanceof WeakSet) return existing;
  const created = new WeakSet<object>();
  Reflect.set(globalThis, MULTIPART_KEY, created);
  return created;
})();

const currentAdapter = (): AdapterLike | undefined => {
  const held: unknown = Reflect.get(globalThis, CURRENT_ADAPTER_KEY);
  return isAdapter(held) ? held : undefined;
};

const declareMultipart = (adapter?: object): void => {
  const target = adapter ?? currentAdapter();
  if (target !== undefined) registry.add(target);
};

const parsesMultipart = (adapter: object): boolean => registry.has(adapter);

/**
 * Remembers the adapter an upload island should mark when `HttpAdapterHost` carries a token the
 * island cannot inject. It is the newest one constructed, so `declareMultipart()` without an
 * argument is only unambiguous while one application runs per process.
 */
const rememberAdapter = (adapter: object): void => {
  Reflect.set(globalThis, CURRENT_ADAPTER_KEY, adapter);
};

export { declareMultipart, parsesMultipart, rememberAdapter };

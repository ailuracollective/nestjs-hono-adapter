/** The adapters whose multipart bodies the island owns. */
type MultipartRegistry = WeakSet<object>;

/** An adapter, as far as this registry is concerned. */
interface AdapterLike {
  /** The platform the adapter answers with. */
  getType: () => string;
}

/** The process-wide key the multipart registry is kept under. */
const MULTIPART_KEY = Symbol.for(
  '@ailura/nestjs-hono-adapter:multipart',
);

/** The process-wide key the latest adapter is kept under. */
const CURRENT_ADAPTER_KEY = Symbol.for(
  '@ailura/nestjs-hono-adapter:current-adapter',
);

/** Says whether a value carries the adapter surface. */
const isAdapter = (value: unknown): value is AdapterLike =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getType') === 'function';

/**
 * Kept on `globalThis` so every copy of this module shares one
 * registry: the mark must cross a duplicated `@nestjs/core`.
 */
const registry = ((): MultipartRegistry => {
  const existing: unknown = Reflect.get(
    globalThis,
    MULTIPART_KEY,
  );
  if (existing instanceof WeakSet) {
    return existing;
  }
  const created = new WeakSet<object>();
  Reflect.set(globalThis, MULTIPART_KEY, created);
  return created;
})();

/** The adapter most recently built in this process, if any. */
const currentAdapter = (): AdapterLike | undefined => {
  const held: unknown = Reflect.get(
    globalThis,
    CURRENT_ADAPTER_KEY,
  );
  return isAdapter(held) ? held : undefined;
};

/** Marks an adapter whose bodies the upload island owns. */
const declareMultipart = (adapter?: object): void => {
  const target = adapter ?? currentAdapter();
  if (target !== undefined) {
    registry.add(target);
  }
};

/** Whether the upload island owns this adapter's bodies. */
const parsesMultipart = (adapter: object): boolean =>
  registry.has(adapter);

/**
 * Remembers the adapter an upload island should mark when
 * `HttpAdapterHost` carries a token the island cannot inject.
 */
const rememberAdapter = (adapter: object): void => {
  Reflect.set(globalThis, CURRENT_ADAPTER_KEY, adapter);
};

export { declareMultipart, parsesMultipart, rememberAdapter };

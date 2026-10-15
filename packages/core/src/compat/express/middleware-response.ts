import type { NestContext } from '#adapter/core/context';

interface MiddlewareResponse {
  readonly commit: () => void;
  readonly proxy: NestContext;
}

const HIDDEN = 'set';
const isCallable = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';
const headerReaders = (
  context: NestContext,
  locals: Record<string, unknown>,
  writeHead: (status?: number) => NestContext,
): Record<string, unknown> => ({
  appendHeader: (name: string, value: string): void => {
    context.header(name, value, { append: true });
  },
  getHeader: (name: string): string | undefined => context.res.headers.get(name) ?? undefined,
  hasHeader: (name: string): boolean => context.res.headers.has(name),
  get headersSent(): boolean {
    return context.finalized;
  },
  locals,
  // `graphql-upload` waits on the response's `close` to notice a mid-upload disconnect.
  once: (event: string, listener: () => void): unknown => {
    const lifecycle = context.env.outgoing ?? context.env.incoming;
    if (lifecycle === undefined) return undefined;
    return lifecycle.once(event, listener);
  },
  removeHeader: (name: string): void => {
    context.res.headers.delete(name);
  },
  // `cookies.set` hands `Set-Cookie` over as an array of cookies; other callers pass a string.
  setHeader: (name: string, value: string | readonly string[]): void => {
    if (typeof value === 'string') {
      context.header(name, value);
      return;
    }
    for (const entry of value) context.header(name, entry, { append: true });
  },
  get statusCode(): number {
    return context.res.status;
  },
  writeHead,
});

const proxyHandler = (
  context: NestContext,
  overrides: Map<string, unknown>,
  readers: Record<string, unknown>,
): ProxyHandler<Record<string, unknown>> => ({
  get(target, property): unknown {
    if (typeof property !== 'string') return Reflect.get(target, property);
    if (property === HIDDEN) return undefined;
    if (overrides.has(property)) return overrides.get(property);
    if (Object.hasOwn(readers, property)) return readers[property];
    const value = Reflect.get(target, property);
    // Hono's context methods reach private fields, which a proxy does not forward, so they run
    // against the context itself rather than the proxy.
    return isCallable(value) ? value.bind(context) : value;
  },
  has(target, property): boolean {
    if (typeof property !== 'string') return Reflect.has(target, property);
    return property !== HIDDEN && Reflect.has(target, property);
  },
  set(target, property, value): boolean {
    if (property === 'writeHead') {
      overrides.set(property, value);
      return true;
    }
    return Reflect.set(target, property, value);
  },
});

// `cookies` reads a present `res.set` as a real `ServerResponse`, so the proxy hides it.
const middlewareResponse = (context: NestContext): MiddlewareResponse => {
  const overrides = new Map<string, unknown>();
  const locals: Record<string, unknown> = {};
  const state: { proxy: NestContext } = { proxy: context };
  const writeHead = (status?: number): NestContext => {
    if (typeof status === 'number') {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Hono types `status` with its StatusCode union; the fitted Express surface takes any number.
      (context.status as unknown as (code: number) => void)(status);
    }
    return state.proxy;
  };
  const handler = proxyHandler(context, overrides, headerReaders(context, locals, writeHead));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the proxy layers Express response semantics onto the Hono context.
  const target = context as unknown as Record<string, unknown>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the handler keeps the context's shape, so the proxy answers as a NestContext.
  state.proxy = new Proxy(target, handler) as unknown as NestContext;
  const commit = (): void => {
    const patched = overrides.get('writeHead');
    if (isCallable(patched)) patched.call(state.proxy, context.res.status);
  };
  return { commit, proxy: state.proxy };
};
export { middlewareResponse };
export type { MiddlewareResponse };

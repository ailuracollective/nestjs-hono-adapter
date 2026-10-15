import type { NestContext } from '#adapter/core/context';
import { attach, bytesOf, writeBody } from './response-body.ts';
import { isCallable, proxyHandler } from './proxy-handler.ts';
import { writer } from './surface.ts';

interface MiddlewareResponse {
  readonly commit: () => void;
  readonly proxy: NestContext;
}

const headerReaders = (
  context: NestContext,
  locals: Record<string, unknown>,
  writeHead: (status?: number) => NestContext,
): Record<string, unknown> => {
  const chunks: Uint8Array[] = [];
  return {
    addListener: (event: string, listener: () => void): unknown =>
      attach(context, { event, listener, method: 'addListener' }),
    appendHeader: (name: string, value: string): void => {
      context.header(name, value, { append: true });
    },
    end: (body?: unknown): void => {
      if (body !== undefined) chunks.push(bytesOf(body));
      writeBody(context, chunks);
    },
    getHeader: (name: string): string | undefined => context.res.headers.get(name) ?? undefined,
    hasHeader: (name: string): boolean => context.res.headers.has(name),
    get headersSent(): boolean {
      return context.finalized;
    },
    locals,
    off: (event: string, listener: () => void): unknown =>
      attach(context, { event, listener, method: 'off' }),
    on: (event: string, listener: () => void): unknown =>
      attach(context, { event, listener, method: 'on' }),
    once: (event: string, listener: () => void): unknown =>
      attach(context, { event, listener, method: 'once' }),
    removeHeader: (name: string): void => {
      context.res.headers.delete(name);
    },
    removeListener: (event: string, listener: () => void): unknown =>
      attach(context, { event, listener, method: 'removeListener' }),
    // `cookies.set` hands `Set-Cookie` over as an array of cookies; other callers pass a string.
    setHeader: (name: string, value: string | readonly string[]): void => {
      if (typeof value === 'string') {
        context.header(name, value);
        return;
      }
      for (const entry of value) context.header(name, entry, { append: true });
    },
    get statusCode(): number {
      return writer.statusOf(context) ?? context.res.status;
    },
    write: (chunk: unknown): boolean => {
      chunks.push(bytesOf(chunk));
      return true;
    },
    writeHead,
  };
};

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

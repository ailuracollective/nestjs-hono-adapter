import type { NestContext } from '#adapter/core/context';
import { writer } from './surface.ts';

const encoder = new TextEncoder();

const bytesOf = (chunk: unknown): Uint8Array => {
  if (typeof chunk === 'string') return encoder.encode(chunk);
  if (chunk instanceof Uint8Array) return chunk;
  return encoder.encode(String(chunk));
};

const joinChunks = (chunks: readonly Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, part) => sum + part.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined;
};

// The body a Node-style middleware left through `write`/`end` is what answers the request.
const writeBody = (context: NestContext, chunks: readonly Uint8Array[]): void => {
  if (chunks.length === 0) {
    writer.end(context);
    return;
  }
  writer.reply(context, joinChunks(chunks));
};

type LifecycleMethod = 'addListener' | 'off' | 'on' | 'once' | 'removeListener';

interface Emitter {
  readonly addListener: (event: string, listener: () => void) => unknown;
  readonly off: (event: string, listener: () => void) => unknown;
  readonly on: (event: string, listener: () => void) => unknown;
  readonly once: (event: string, listener: () => void) => unknown;
  readonly removeListener: (event: string, listener: () => void) => unknown;
}

interface ListenRequest {
  readonly event: string;
  readonly listener: () => void;
  readonly method: LifecycleMethod;
}

const listen = (lifecycle: Emitter, request: ListenRequest): unknown => {
  const { event, listener, method } = request;
  if (method === 'on') return lifecycle.on(event, listener);
  if (method === 'once') return lifecycle.once(event, listener);
  if (method === 'off') return lifecycle.off(event, listener);
  if (method === 'addListener') return lifecycle.addListener(event, listener);
  return lifecycle.removeListener(event, listener);
};

/**
 * A middleware treats the response as a Node stream — `compression` listens on it before it decides
 * to compress, `graphql-upload` waits on `close` to notice a mid-upload disconnect — so the
 * listeners land on the transport's own response when it carries one.
 */
const attach = (context: NestContext, request: ListenRequest): unknown => {
  const lifecycle = context.env.outgoing ?? context.env.incoming;
  if (lifecycle === undefined) return undefined;
  return listen(lifecycle, request);
};

export { attach, bytesOf, writeBody };

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

const writeBody = (context: NestContext, chunks: readonly Uint8Array[]): void => {
  if (chunks.length === 0) {
    writer.end(context);
    return;
  }
  writer.reply(context, joinChunks(chunks));
};

export { bytesOf, writeBody };

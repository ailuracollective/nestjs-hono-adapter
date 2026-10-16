import { Readable } from 'node:stream';

import { defaultContentType, setDisposition } from '#adapter/core/response/headers';

import { BINARY_CONTENT_TYPE, TEXT_CONTENT_TYPE } from './content.ts';

interface StreamableFileLike {
  getHeaders: () => {
    type?: string | undefined;
    disposition?: string | string[] | undefined;
    length?: number | undefined;
  };
  getStream: () => Readable;
}

const isStreamableFile = (value: unknown): value is StreamableFileLike =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'getStream') === 'function' &&
  typeof Reflect.get(value, 'getHeaders') === 'function';

const toBodyStream = (stream: Readable): ReadableStream => {
  const web = Readable.toWeb(stream);
  if (stream.readableObjectMode) return web.pipeThrough(new TextEncoderStream());
  return web;
};

const toTextResponse = (
  body: string | number | boolean | bigint,
  status: number,
  headers: Headers,
): Response => {
  defaultContentType(headers, TEXT_CONTENT_TYPE);
  return new Response(String(body), { headers, status });
};

const toFileResponse = (file: StreamableFileLike, status: number, headers: Headers): Response => {
  const { type, disposition, length } = file.getHeaders();
  if (type !== undefined && type !== '') headers.set('content-type', type);
  if (disposition !== undefined) {
    for (const value of Array.isArray(disposition) ? disposition : [disposition]) {
      setDisposition(headers, value);
    }
  }
  if (length !== undefined) headers.set('content-length', String(length));
  return new Response(toBodyStream(file.getStream()), {
    headers,
    status,
  });
};

const toBinaryResponse = (
  body: Uint8Array | ArrayBuffer | ReadableStream,
  status: number,
  headers: Headers,
): Response => {
  defaultContentType(headers, BINARY_CONTENT_TYPE);
  return new Response(body, { headers, status });
};

export { isStreamableFile, toBinaryResponse, toBodyStream, toFileResponse, toTextResponse };
export type { StreamableFileLike };

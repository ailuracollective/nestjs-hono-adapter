import { Readable } from 'node:stream';

import type { StreamableFile } from '@nestjs/common';

import {
  defaultContentType,
  headerInit,
  setDisposition,
} from '#adapter/core/response/headers';
import type { HeaderRecord } from '#adapter/core/response/headers';

import {
  BINARY_CONTENT_TYPE,
  TEXT_CONTENT_TYPE,
} from './content.ts';

const toBodyStream = (stream: Readable): ReadableStream => {
  const web = Readable.toWeb(stream);
  if (stream.readableObjectMode) {
    return web.pipeThrough(new TextEncoderStream());
  }
  return web;
};

/** Answers a primitive value as text. */
const toTextResponse = (
  body: string | number | boolean | bigint,
  status: number,
  headers: HeaderRecord,
): Response => {
  defaultContentType(headers, TEXT_CONTENT_TYPE);
  return new Response(String(body), {
    headers: headerInit(headers),
    status,
  });
};

/** Streams a file Nest built, keeping the headers it declares. */
const toFileResponse = (
  file: StreamableFile,
  status: number,
  headers: HeaderRecord,
): Response => {
  const { type, disposition, length } = file.getHeaders();
  if (type !== '') {
    headers['content-type'] = type;
  }
  if (disposition !== undefined) {
    for (const value of Array.isArray(disposition)
      ? disposition
      : [disposition]) {
      setDisposition(headers, value);
    }
  }
  if (length !== undefined) {
    headers['content-length'] = String(length);
  }
  return new Response(toBodyStream(file.getStream()), {
    headers: headerInit(headers),
    status,
  });
};

/** Answers a body of bytes with the binary type. */
const toBinaryResponse = (
  body: Uint8Array | ArrayBuffer | ReadableStream,
  status: number,
  headers: HeaderRecord,
): Response => {
  defaultContentType(headers, BINARY_CONTENT_TYPE);
  return new Response(body, {
    headers: headerInit(headers),
    status,
  });
};

export {
  toBinaryResponse,
  toBodyStream,
  toFileResponse,
  toTextResponse,
};

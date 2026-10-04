/**
 * The response half of the bridge: what a value Nest returned
 * becomes as a Web response.
 *
 * Every kind of answer converges on one `Response`, so this is
 * where a status, the headers `@Header()` recorded and the body
 * itself are decided. Both content types live here rather than
 * beside their callers because each is written once, for the
 * one body shape that needs it.
 *
 * This half is the only one that reaches Node at runtime, and
 * it reaches it once: `StreamableFile` arrives as a Node stream
 * and has to be handed to the Web response as one.
 */
import { Readable } from 'node:stream';

import { HttpStatus, StreamableFile } from '@nestjs/common';

import type { NestContext } from './context.ts';

const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';
const TEXT_CONTENT_TYPE = 'text/plain; charset=UTF-8';

function isPrimitive(
  body: unknown,
): body is string | number | boolean | bigint {
  const kind = typeof body;
  return (
    kind === 'string' ||
    kind === 'number' ||
    kind === 'boolean' ||
    kind === 'bigint'
  );
}

function isBinaryBody(
  body: unknown,
): body is Uint8Array | ArrayBuffer | ReadableStream {
  return (
    body instanceof Uint8Array ||
    body instanceof ArrayBuffer ||
    body instanceof ReadableStream
  );
}

function toTextResponse(
  body: string | number | boolean | bigint,
  status: number,
  headers: Headers,
): Response {
  if (!headers.has('content-type')) {
    headers.set('content-type', TEXT_CONTENT_TYPE);
  }
  return new Response(String(body), { headers, status });
}

function toList(
  value: string | readonly string[],
): readonly string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return value;
}

/**
 * Writes the disposition a file declares. Nest accepts a list,
 * which Node treats as one header line per entry, so each entry
 * is appended rather than overwritten.
 */
function setDisposition(
  headers: Headers,
  disposition: string | readonly string[],
): void {
  for (const value of toList(disposition)) {
    headers.append('content-disposition', value);
  }
}

/**
 * Streams a file Nest built, keeping the headers it declares.
 * `StreamableFile` is the one response type that reaches the
 * adapter as a Node stream, so it is converted here rather than
 * buffered.
 */
function toFileResponse(
  file: StreamableFile,
  status: number,
  headers: Headers,
): Response {
  const { type, disposition, length } = file.getHeaders();
  if (type !== '') {
    headers.set('content-type', type);
  }
  if (disposition !== undefined) {
    setDisposition(headers, disposition);
  }
  if (length !== undefined) {
    headers.set('content-length', String(length));
  }
  return new Response(Readable.toWeb(file.getStream()), {
    headers,
    status,
  });
}

function toResponse(
  body: unknown,
  status: number,
  headers: Headers,
): Response {
  if (body === undefined || body === null) {
    return new Response(undefined, { headers, status });
  }
  if (body instanceof StreamableFile) {
    return toFileResponse(body, status, headers);
  }
  if (isBinaryBody(body)) {
    return new Response(body, { headers, status });
  }
  if (isPrimitive(body)) {
    return toTextResponse(body, status, headers);
  }
  headers.set('content-type', JSON_CONTENT_TYPE);
  return Response.json(body, { headers, status });
}

/**
 * Builds the Web response for a value Nest returned.
 *
 * The headers already recorded on the context are copied first:
 * `@Header()` reaches the adapter through `setHeader()`, which
 * stores them on the context, and replacing the response would
 * otherwise drop them.
 */
function buildResponse(
  context: NestContext,
  body: unknown,
  status: number = HttpStatus.OK,
): Response {
  return toResponse(
    body,
    status,
    new Headers(context.res.headers),
  );
}

export { buildResponse };

import { Readable } from 'node:stream';

import { HttpStatus, StreamableFile } from '@nestjs/common';

import type { NestContext } from './context.ts';

const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';
const TEXT_CONTENT_TYPE = 'text/plain; charset=UTF-8';

/** The type a raw binary answer is labelled with. */
const BINARY_CONTENT_TYPE = 'application/octet-stream';

/**
 * The statuses Fetch forbids a body on. A handler declared
 * `@HttpCode(HttpStatus.NO_CONTENT)` may still return a value
 * and the `Response` constructor throws on that pair instead of
 * dropping the value, so the throw would reach the client as a
 * 500 where every other Nest adapter answers the status alone.
 */
const NULL_BODY_STATUS = new Set([
  HttpStatus.SWITCHING_PROTOCOLS,
  HttpStatus.PROCESSING,
  HttpStatus.NO_CONTENT,
  HttpStatus.RESET_CONTENT,
  HttpStatus.NOT_MODIFIED,
]);

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

/**
 * The headers of an answer, as a plain record rather than a
 * `Headers`: a `Headers` validates every name and value through
 * the WebIDL converters and the transport then walks the result
 * a second time, and an answer with the default security
 * headers on carries twelve. A record is written straight
 * through.
 */
type HeaderRecord = Record<string, string | string[]>;

/**
 * Adds one value to a header that may already carry some; Nest
 * accepts a header as a list, Node writes it as lines.
 */
function appendHeader(
  headers: HeaderRecord,
  name: string,
  value: string,
): void {
  const seen = headers[name];
  if (seen === undefined) {
    headers[name] = value;
  } else if (typeof seen === 'string') {
    headers[name] = [seen, value];
  } else {
    seen.push(value);
  }
}

/**
 * The headers already recorded on the context, read before the
 * answer that carries them replaces the response they sit on.
 */
function recordedHeaders(context: NestContext): HeaderRecord {
  const headers: HeaderRecord = {};
  for (const [name, value] of context.res.headers.entries()) {
    appendHeader(headers, name, value);
  }
  return headers;
}

/**
 * Labels the answer with the inferred type, unless the handler
 * declared one. An explicit `Content-Type` is the handler's own
 * answer, so it is read the same way whatever shape the
 * returned value took.
 */
function defaultContentType(
  headers: HeaderRecord,
  inferred: string,
): void {
  headers['content-type'] ??= inferred;
}

function toTextResponse(
  body: string | number | boolean | bigint,
  status: number,
  headers: HeaderRecord,
): Response {
  defaultContentType(headers, TEXT_CONTENT_TYPE);
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
 * Writes the disposition a file declares, one header line per
 * entry as Node treats a list.
 */
function setDisposition(
  headers: HeaderRecord,
  disposition: string | readonly string[],
): void {
  for (const value of toList(disposition)) {
    appendHeader(headers, 'content-disposition', value);
  }
}

/**
 * The web stream a Node file stream becomes. A file can sit on
 * an object-mode stream yielding values that are not bytes, so
 * such a stream is encoded on the way out: the Node writer
 * tolerates a string and the runtimes that read the body as
 * bytes do not.
 */
function toBodyStream(stream: Readable): ReadableStream {
  const web = Readable.toWeb(stream);
  if (stream.readableObjectMode) {
    return web.pipeThrough(new TextEncoderStream());
  }
  return web;
}

/**
 * Streams a file Nest built, keeping the headers it declares;
 * `StreamableFile` is the one response type that arrives as a
 * Node stream.
 */
function toFileResponse(
  file: StreamableFile,
  status: number,
  headers: HeaderRecord,
): Response {
  const { type, disposition, length } = file.getHeaders();
  if (type !== '') {
    headers['content-type'] = type;
  }
  if (disposition !== undefined) {
    setDisposition(headers, disposition);
  }
  if (length !== undefined) {
    headers['content-length'] = String(length);
  }
  return new Response(toBodyStream(file.getStream()), {
    headers,
    status,
  });
}

/**
 * Answers a body of bytes with the binary type, unless the
 * handler declared its own.
 */
function toBinaryResponse(
  body: Uint8Array | ArrayBuffer | ReadableStream,
  status: number,
  headers: HeaderRecord,
): Response {
  defaultContentType(headers, BINARY_CONTENT_TYPE);
  return new Response(body, { headers, status });
}

/**
 * Answers a value as JSON, written out rather than reached for
 * through `Response.json()`, which copies what it is given into
 * a `Headers` of its own — a second validation pass over every
 * header, on the one path every request returning a value
 * takes.
 */
function jsonResponse(
  body: unknown,
  headers: HeaderRecord,
  status: number,
): Response {
  const serialized = JSON.stringify(body);
  if (typeof serialized !== 'string') {
    throw new TypeError('The data is not JSON serializable');
  }
  return new Response(serialized, { headers, status });
}

function toResponse(
  body: unknown,
  status: number,
  headers: HeaderRecord,
): Response {
  if (
    body === undefined ||
    body === null ||
    NULL_BODY_STATUS.has(status)
  ) {
    return new Response(undefined, { headers, status });
  }
  if (body instanceof StreamableFile) {
    return toFileResponse(body, status, headers);
  }
  if (isBinaryBody(body)) {
    return toBinaryResponse(body, status, headers);
  }
  if (isPrimitive(body)) {
    return toTextResponse(body, status, headers);
  }
  defaultContentType(headers, JSON_CONTENT_TYPE);
  return jsonResponse(body, headers, status);
}

/**
 * Builds the Web response for a value Nest returned. The
 * headers already on the context are copied first: `@Header()`
 * reaches the adapter through `setHeader()`, and replacing the
 * response would otherwise drop them. Reading them materializes
 * a response that Hono would then merge with this one, and the
 * merge reads `body` off the answer — spending the one thing
 * that lets the transport write it in a single call. Clearing
 * it through the public setter leaves nothing to merge.
 */
function buildResponse(
  context: NestContext,
  body: unknown,
  status: number,
): Response {
  const headers = recordedHeaders(context);
  context.res = undefined;
  return toResponse(body, status, headers);
}

export { buildResponse };

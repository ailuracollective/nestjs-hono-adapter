import { HttpStatus } from '@nestjs/common';

const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';

const TEXT_CONTENT_TYPE = 'text/plain; charset=UTF-8';

const BINARY_CONTENT_TYPE = 'application/octet-stream';

const NULL_BODY_STATUS = new Set([
  HttpStatus.SWITCHING_PROTOCOLS,
  HttpStatus.PROCESSING,
  HttpStatus.NO_CONTENT,
  HttpStatus.RESET_CONTENT,
  HttpStatus.NOT_MODIFIED,
]);

const isPrimitive = (body: unknown): body is string | number | boolean | bigint => {
  const kind = typeof body;
  return kind === 'string' || kind === 'number' || kind === 'boolean' || kind === 'bigint';
};

const isBinaryBody = (body: unknown): body is Uint8Array | ArrayBuffer | ReadableStream =>
  body instanceof Uint8Array || body instanceof ArrayBuffer || body instanceof ReadableStream;

export {
  BINARY_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
  NULL_BODY_STATUS,
  TEXT_CONTENT_TYPE,
  isBinaryBody,
  isPrimitive,
};

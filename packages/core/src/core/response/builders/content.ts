import { HttpStatus } from '@nestjs/common';

const JSON_CONTENT_TYPE = 'application/json; charset=UTF-8';

/** The label a plain-text answer carries. */
const TEXT_CONTENT_TYPE = 'text/plain; charset=UTF-8';

/** The type a raw binary answer is labelled with. */
const BINARY_CONTENT_TYPE = 'application/octet-stream';

/** The statuses Fetch forbids a body on. */
const NULL_BODY_STATUS = new Set([
  HttpStatus.SWITCHING_PROTOCOLS,
  HttpStatus.PROCESSING,
  HttpStatus.NO_CONTENT,
  HttpStatus.RESET_CONTENT,
  HttpStatus.NOT_MODIFIED,
]);

/** Whether a value is answered as text. */
const isPrimitive = (
  body: unknown,
): body is string | number | boolean | bigint => {
  const kind = typeof body;
  return (
    kind === 'string' ||
    kind === 'number' ||
    kind === 'boolean' ||
    kind === 'bigint'
  );
};

/** Whether a value is answered as bytes. */
const isBinaryBody = (
  body: unknown,
): body is Uint8Array | ArrayBuffer | ReadableStream =>
  body instanceof Uint8Array ||
  body instanceof ArrayBuffer ||
  body instanceof ReadableStream;

/** The web stream a Node file stream becomes. */

export {
  BINARY_CONTENT_TYPE,
  JSON_CONTENT_TYPE,
  NULL_BODY_STATUS,
  TEXT_CONTENT_TYPE,
  isBinaryBody,
  isPrimitive,
};

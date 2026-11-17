import { defaultContentType } from '#adapter/core/response/headers';

import { JSON_CONTENT_TYPE, NULL_BODY_STATUS, isBinaryBody, isPrimitive } from './content.ts';
import { isStreamableFile, toBinaryResponse, toFileResponse, toTextResponse } from './encode.ts';
import type { ResponseParts } from './encode.ts';

const jsonResponse = (body: unknown, parts: ResponseParts): Response => {
  const { headers, status } = parts;
  defaultContentType(headers, JSON_CONTENT_TYPE);
  const serialized = JSON.stringify(body);
  if (typeof serialized !== 'string') throw new TypeError('The data is not JSON serializable');
  return new Response(serialized, { headers, status });
};

const toResponse = (body: unknown, parts: ResponseParts): Response => {
  if (body === undefined || body === null || NULL_BODY_STATUS.has(parts.status)) {
    return new Response(undefined, { headers: parts.headers, status: parts.status });
  }
  if (isStreamableFile(body)) return toFileResponse(body, parts);
  if (isBinaryBody(body)) return toBinaryResponse(body, parts.status, parts.headers);
  if (isPrimitive(body)) return toTextResponse(body, parts.status, parts.headers);
  return jsonResponse(body, parts);
};

export { toResponse, jsonResponse };

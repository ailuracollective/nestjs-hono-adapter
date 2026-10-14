import { defaultContentType } from '#adapter/core/response/headers';

import { JSON_CONTENT_TYPE, NULL_BODY_STATUS, isBinaryBody, isPrimitive } from './content.ts';
import { isStreamableFile, toBinaryResponse, toFileResponse, toTextResponse } from './encode.ts';

const jsonResponse = (body: unknown, headers: Headers, status: number): Response => {
  const serialized = JSON.stringify(body);
  if (typeof serialized !== 'string') throw new TypeError('The data is not JSON serializable');
  return new Response(serialized, { headers, status });
};

const toResponse = (body: unknown, status: number, headers: Headers): Response => {
  if (body === undefined || body === null || NULL_BODY_STATUS.has(status)) {
    return new Response(undefined, { headers, status });
  }
  if (isStreamableFile(body)) {
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
};

export { toResponse, jsonResponse };

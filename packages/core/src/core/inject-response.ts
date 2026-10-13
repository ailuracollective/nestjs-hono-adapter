import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import type { InjectCookie, InjectResponse } from './inject.ts';

/** What `indexOf` answers when the separator is not there. */
const NOT_FOUND = -1;

/**
 * How each `set-cookie` attribute maps onto the cookie being
 * built. An attribute that is not here is reported as it came.
 */
const ATTRIBUTES: Record<
  string,
  (cookie: InjectCookie, value: string) => void
> = {
  expires: (cookie, value): void => {
    cookie.expires = new Date(value);
  },
  httponly: (cookie): void => {
    cookie.httpOnly = true;
  },
  'max-age': (cookie, value): void => {
    cookie.maxAge = Number(value);
  },
  samesite: (cookie, value): void => {
    cookie.sameSite = value;
  },
  secure: (cookie): void => {
    cookie.secure = true;
  },
};

/** Splits one part of a header on its first `=`. */
function splitPair(part: string): readonly [string, string] {
  const cut = part.indexOf('=');
  if (cut === NOT_FOUND) {
    return [part, ''];
  }
  return [part.slice(0, cut), part.slice(cut + 1)];
}

/** Reports an attribute light-my-request does not name itself. */
function reportUnknown(
  cookie: InjectCookie,
  name: string,
  rawValue: string,
): void {
  if (rawValue === '') {
    cookie[name] = true;
    return;
  }
  cookie[name] = rawValue.trim();
}

/**
 * Reports one `set-cookie` attribute on the cookie built so
 * far.
 */
function applyAttribute(
  cookie: InjectCookie,
  attribute: string,
): void {
  const [rawName, rawValue] = splitPair(attribute);
  const name = rawName.trim().toLowerCase();
  const reported = ATTRIBUTES[name];
  if (reported === undefined) {
    reportUnknown(cookie, name, rawValue);
    return;
  }
  reported(cookie, rawValue.trim());
}

/** One `set-cookie` header, as light-my-request reports it. */
function toCookie(raw: string): InjectCookie {
  const [pair = '', ...attributes] = raw.split(';');
  const [name, value] = splitPair(pair);
  const cookie: InjectCookie = {
    name: name.trim(),
    value: value.trim(),
  };
  for (const attribute of attributes) {
    applyAttribute(cookie, attribute);
  }
  return cookie;
}

/** The answer's headers, with `set-cookie` kept as a list. */
function toHeaderRecord(
  headers: Headers,
): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const [name, value] of headers) {
    record[name] = value;
  }
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) {
    record['set-cookie'] = cookies;
  }
  return record;
}

/**
 * Reads a body as JSON, when a caller asks for it. Parsing here
 * rather than while the answer is wrapped is what an answer
 * that is not JSON needs: light-my-request's `json()` throws
 * only when it is called.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a caller that named a type keeps naming it.
function toJson<Answer>(text: string): Answer {
  const parsed: unknown = JSON.parse(text);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the caller names the shape it expects, and nothing can check one at runtime.
  return parsed as Answer;
}

/** Wraps an answer the way light-my-request reports one. */
async function toResponse(
  response: Response,
): Promise<InjectResponse> {
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString('utf8');
  const { headers, status, statusText } = response;
  return {
    body: text,
    cookies: headers.getSetCookie().map((raw) => toCookie(raw)),
    headers: toHeaderRecord(headers),
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a caller that named a type keeps naming it.
    json: <Answer = unknown>() => toJson<Answer>(text),
    payload: text,
    rawPayload: bytes,
    statusCode: status,
    statusMessage: statusText,
    stream: () => Readable.from([bytes]),
  };
}

export { toResponse };

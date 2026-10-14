import type { NestHono } from '#adapter/core/context';
import { send, splitTarget } from './request/index.ts';
import type {
  InjectCookie,
  InjectOptions,
  InjectResponse,
  InjectRunner,
  InjectUrl,
  Target,
} from './types.ts';
import { ATTRIBUTES, NOT_FOUND, REFUSED } from './constants.ts';
import { Readable } from 'node:stream';

/** The options a call named, in the object form. */
const asOptions = (
  options: string | InjectOptions,
): InjectOptions => {
  if (typeof options === 'string') {
    return { url: options };
  }
  return options;
};

/** Refuses the options that would change the answer. */
const refuse = (asked: InjectOptions): void => {
  for (const [name, given] of Object.entries(asked)) {
    const reason = REFUSED[name];
    if (reason !== undefined && given !== undefined) {
      throw new Error(
        `inject() cannot honour the ${name} option: ${reason}.`,
      );
    }
  }
};

/** The string form split, or the object form kept whole. */
const asSplit = (raw: string | InjectUrl): Target => {
  if (typeof raw === 'string') {
    return splitTarget(raw);
  }
  return { method: '', url: raw };
};

/** The method a call asks for, in upper case. */
const resolveMethod = (
  asked: InjectOptions,
  carried: string,
): string => {
  const { method } = asked;
  const named = method ?? carried;
  if (named === '') {
    return 'GET';
  }
  return named.toUpperCase();
};

/** The target a call names, and the method it asks for. */
const toTarget = (asked: InjectOptions): Target => {
  const { path, url } = asked;
  const raw = url ?? path ?? '/';
  const carried = asSplit(raw);
  return {
    method: resolveMethod(asked, carried.method),
    url: carried.url,
  };
};

/** Splits one part of a header on its first `=`. */
const splitPair = (part: string): readonly [string, string] => {
  const cut = part.indexOf('=');
  if (cut === NOT_FOUND) {
    return [part, ''];
  }
  return [part.slice(0, cut), part.slice(cut + 1)];
};

/** Reports an attribute the parser does not name itself. */
const reportUnknown = (
  cookie: InjectCookie,
  name: string,
  rawValue: string,
): void => {
  if (rawValue === '') {
    cookie[name] = true;
    return;
  }
  cookie[name] = rawValue.trim();
};

/** Reports one `set-cookie` attribute. */
const applyAttribute = (
  cookie: InjectCookie,
  attribute: string,
): void => {
  const [rawName, rawValue] = splitPair(attribute);
  const name = rawName.trim().toLowerCase();
  const reported = ATTRIBUTES[name];
  if (reported === undefined) {
    reportUnknown(cookie, name, rawValue);
    return;
  }
  reported(cookie, rawValue.trim());
};

/** One `set-cookie` header parsed into a cookie. */
const toCookie = (raw: string): InjectCookie => {
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
};

/** The answer's headers, with `set-cookie` kept as a list. */
const toHeaderRecord = (
  headers: Headers,
): Record<string, string | string[]> => {
  const record: Record<string, string | string[]> = {};
  for (const [name, value] of headers) {
    record[name] = value;
  }
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) {
    record['set-cookie'] = cookies;
  }
  return record;
};

/** Reads a body as JSON, when a caller asks for it. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a caller that named a type keeps naming it.
const toJson = <Answer>(text: string): Answer => {
  const parsed: unknown = JSON.parse(text);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the caller names the shape it expects, and nothing can check one at runtime.
  return parsed as Answer;
};

/** Wraps an answer into the injected response shape. */
const toResponse = async (
  response: Response,
): Promise<InjectResponse> => {
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
};

/** Builds the runner the adapter carries as `inject`. */
const createInject =
  (app: NestHono): InjectRunner =>
  async (options = {}): Promise<InjectResponse> => {
    const asked = asOptions(options);
    refuse(asked);
    const target = toTarget(asked);
    const response = await send(app, asked, target);
    return toResponse(response);
  };

export { createInject, toResponse };

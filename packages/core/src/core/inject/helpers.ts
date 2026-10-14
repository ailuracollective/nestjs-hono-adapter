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

const asOptions = (options: string | InjectOptions): InjectOptions => {
  if (typeof options === 'string') {
    return { url: options };
  }
  return options;
};

const refuse = (asked: InjectOptions): void => {
  for (const [name, given] of Object.entries(asked)) {
    const reason = REFUSED[name];
    if (reason !== undefined && given !== undefined) {
      throw new Error(`inject() cannot honour the ${name} option: ${reason}.`);
    }
  }
};

const asSplit = (raw: string | InjectUrl): Target => {
  if (typeof raw === 'string') return splitTarget(raw);
  return { method: '', url: raw };
};

const resolveMethod = (asked: InjectOptions, carried: string): string => {
  const { method } = asked;
  const named = method ?? carried;
  if (named === '') return 'GET';
  return named.toUpperCase();
};

const toTarget = (asked: InjectOptions): Target => {
  const { path, url } = asked;
  const raw = url ?? path ?? '/';
  const carried = asSplit(raw);
  return {
    method: resolveMethod(asked, carried.method),
    url: carried.url,
  };
};

const splitPair = (part: string): readonly [string, string] => {
  const cut = part.indexOf('=');
  if (cut === NOT_FOUND) return [part, ''];
  return [part.slice(0, cut), part.slice(cut + 1)];
};

const reportUnknown = (cookie: InjectCookie, name: string, rawValue: string): void => {
  if (rawValue === '') {
    cookie[name] = true;
    return;
  }
  cookie[name] = rawValue.trim();
};

const applyAttribute = (cookie: InjectCookie, attribute: string): void => {
  const [rawName, rawValue] = splitPair(attribute);
  const name = rawName.trim().toLowerCase();
  const reported = ATTRIBUTES[name];
  if (reported === undefined) {
    reportUnknown(cookie, name, rawValue);
    return;
  }
  reported(cookie, rawValue.trim());
};

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

const toHeaderRecord = (headers: Headers): Record<string, string | string[]> => {
  const record: Record<string, string | string[]> = {};
  for (const [name, value] of headers) {
    record[name] = value;
  }
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) record['set-cookie'] = cookies;
  return record;
};

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a caller that named a type keeps naming it.
const toJson = <Answer>(text: string): Answer => {
  const parsed: unknown = JSON.parse(text);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the caller names the shape it expects, and nothing can check one at runtime.
  return parsed as Answer;
};

const toResponse = async (response: Response): Promise<InjectResponse> => {
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

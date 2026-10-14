import type { NestHono } from '#adapter/core/context';
import type {
  InjectBody,
  InjectHeaders,
  InjectOptions,
  InjectPayload,
  Target,
} from '#adapter/core/inject/types';
import { toUrl, toValues } from './url.ts';

/** Copies the headers a call named, lists included. */
const appendHeaders = (
  headers: Headers,
  sent: InjectHeaders,
): void => {
  for (const [name, value] of Object.entries(sent)) {
    if (value !== undefined) {
      for (const each of toValues(value)) {
        headers.append(name, each);
      }
    }
  }
};

/** The `Cookie` value a call asked for. */
const cookieHeader = (
  cookies: Record<string, string>,
): string => {
  const pairs = Object.entries(cookies).map(
    ([name, value]) =>
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
  );
  return pairs.join('; ');
};

/** Sets the cookie header, after whatever was already named. */
const withCookies = (
  headers: Headers,
  cookies: Record<string, string>,
): void => {
  const carried = headers.get('cookie');
  const pairs = cookieHeader(cookies);
  if (carried === null) {
    headers.set('cookie', pairs);
    return;
  }
  headers.set('cookie', `${carried}; ${pairs}`);
};

/** The request headers a call asked for. */
const toHeaders = (options: InjectOptions): Headers => {
  const { cookies, headers: sent } = options;
  const headers = new Headers();
  if (sent !== undefined) {
    appendHeaders(headers, sent);
  }
  if (cookies !== undefined) {
    withCookies(headers, cookies);
  }
  return headers;
};

/** Whether a payload is an object to be written as JSON. */
const isJsonPayload = (
  payload: InjectPayload,
): payload is Record<string, unknown> => {
  if (typeof payload !== 'object') {
    return false;
  }
  if (payload instanceof Uint8Array) {
    return false;
  }
  return !(payload instanceof ArrayBuffer);
};

/** The request body, with an object payload JSON-encoded. */
const toBody = (
  payload: InjectPayload | undefined,
  headers: Headers,
): InjectBody | undefined => {
  if (payload === undefined) {
    return undefined;
  }
  if (isJsonPayload(payload)) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    return JSON.stringify(payload);
  }
  return payload;
};

/** Drives a built request through Hono's own in-process entry. */
const send = (
  app: NestHono,
  asked: InjectOptions,
  target: Target,
): Promise<Response> => {
  const headers = toHeaders(asked);
  const init: RequestInit = {
    headers,
    method: target.method,
  };
  if (target.method !== 'GET' && target.method !== 'HEAD') {
    init.body = toBody(asked.payload ?? asked.body, headers);
  }
  if (asked.signal !== undefined) {
    init.signal = asked.signal;
  }
  return Promise.resolve(
    app.request(toUrl(target.url, asked.query), init, {}),
  );
};

export { send };

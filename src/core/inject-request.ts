import type { NestHono } from './context.ts';
import type {
  InjectBody,
  InjectHeaders,
  InjectOptions,
  InjectPayload,
  InjectQuery,
  InjectUrl,
  Target,
} from './inject.ts';

/** The origin a relative target is resolved against. */
const ORIGIN = 'http://localhost';

/** The string form of a target, with its method split off. */
const TARGET = /^(?<method>[A-Za-z]+) +(?<url>[\S\s]*)$/u;

/** One value or a list of them, as light-my-request accepts. */
function toValues(
  value: string | number | readonly string[],
): readonly string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'number') {
    return [String(value)];
  }
  return value;
}

/**
 * Serialises a query the way light-my-request and `URL` both
 * do.
 */
function toQueryString(query: InjectQuery): string {
  if (typeof query === 'string') {
    return query.replace(/^\?/u, '');
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const each of toValues(value)) {
      params.append(key, each);
    }
  }
  return params.toString();
}

/** The query string a call asked for, or nothing. */
function askedQuery(query: InjectQuery | undefined): string {
  if (query === undefined) {
    return '';
  }
  return toQueryString(query);
}

/** The two query strings a call may carry, joined. */
function mergeQueries(inner: string, appended: string): string {
  if (inner === '') {
    return appended;
  }
  if (appended === '') {
    return inner;
  }
  return `${inner}&${appended}`;
}

/** Appends a query string to a URL that may already carry one. */
function withQuery(url: string, query: string): string {
  if (query === '') {
    return url;
  }
  if (url.includes('?')) {
    return `${url}&${query}`;
  }
  return `${url}?${query}`;
}

/** The path a relative target names, with its leading slash. */
function withSlash(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
}

/** The origin the object form of a target names. */
function originOf(target: InjectUrl): string {
  const { hostname, port, protocol } = target;
  const host = hostname ?? 'localhost';
  const scheme = protocol ?? 'http:';
  if (port === undefined) {
    return `${scheme}//${host}`;
  }
  return `${scheme}//${host}:${port}`;
}

/** The absolute URL a Web `Request` is built from. */
function toUrl(
  target: string | InjectUrl,
  query: InjectQuery | undefined,
): string {
  const appended = askedQuery(query);
  if (typeof target === 'string') {
    return withQuery(`${ORIGIN}${withSlash(target)}`, appended);
  }
  const { pathname, query: inner } = target;
  const merged = mergeQueries(askedQuery(inner), appended);
  return withQuery(`${originOf(target)}${pathname}`, merged);
}

/**
 * `'GET /path'` carries its method; a bare path and a URL do
 * not.
 */
function splitTarget(target: string): Target {
  const trimmed = target.trim();
  const match = TARGET.exec(trimmed);
  if (match === null) {
    return { method: '', url: trimmed };
  }
  const { groups } = match;
  if (groups === undefined) {
    return { method: '', url: trimmed };
  }
  return {
    method: groups.method ?? '',
    url: groups.url ?? trimmed,
  };
}

/** Copies the headers a call named, lists included. */
function appendHeaders(
  headers: Headers,
  sent: InjectHeaders,
): void {
  for (const [name, value] of Object.entries(sent)) {
    if (value !== undefined) {
      for (const each of toValues(value)) {
        headers.append(name, each);
      }
    }
  }
}

/** The `Cookie` value a call asked for. */
function cookieHeader(cookies: Record<string, string>): string {
  const pairs = Object.entries(cookies).map(
    ([name, value]) =>
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
  );
  return pairs.join('; ');
}

/** Sets the cookie header, after whatever was already named. */
function withCookies(
  headers: Headers,
  cookies: Record<string, string>,
): void {
  const carried = headers.get('cookie');
  const pairs = cookieHeader(cookies);
  if (carried === null) {
    headers.set('cookie', pairs);
    return;
  }
  headers.set('cookie', `${carried}; ${pairs}`);
}

/** The request headers, with light-my-request's cookie handling. */
function toHeaders(options: InjectOptions): Headers {
  const { cookies, headers: sent } = options;
  const headers = new Headers();
  if (sent !== undefined) {
    appendHeaders(headers, sent);
  }
  if (cookies !== undefined) {
    withCookies(headers, cookies);
  }
  return headers;
}

/** Whether a payload is an object to be written as JSON. */
function isJsonPayload(
  payload: InjectPayload,
): payload is Record<string, unknown> {
  if (typeof payload !== 'object') {
    return false;
  }
  if (payload instanceof Uint8Array) {
    return false;
  }
  return !(payload instanceof ArrayBuffer);
}

/**
 * The request body. An object payload is JSON-encoded and named
 * as such, which is what light-my-request does with one.
 */
function toBody(
  payload: InjectPayload | undefined,
  headers: Headers,
): InjectBody | undefined {
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
}

/** Drives a built request through Hono's own in-process entry. */
function send(
  app: NestHono,
  asked: InjectOptions,
  target: Target,
): Promise<Response> {
  const headers = toHeaders(asked);
  const body = toBody(asked.payload ?? asked.body, headers);
  const init: RequestInit = {
    body,
    headers,
    method: target.method,
  };
  if (asked.signal !== undefined) {
    init.signal = asked.signal;
  }
  return Promise.resolve(
    app.request(toUrl(target.url, asked.query), init),
  );
}

export { send, splitTarget };

import type { InjectQuery, InjectUrl, Target } from '#adapter/core/inject/types';

const ORIGIN = 'http://localhost';

const TARGET = /^(?<method>[A-Za-z]+) +(?<url>[\S\s]*)$/u;

const toValues = (value: string | number | readonly string[]): readonly string[] => {
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  return value;
};

const toQueryString = (query: InjectQuery): string => {
  if (typeof query === 'string') return query.replace(/^\?/u, '');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const each of toValues(value)) {
      params.append(key, each);
    }
  }
  return params.toString();
};

const askedQuery = (query: InjectQuery | undefined): string => {
  if (query === undefined) return '';
  return toQueryString(query);
};

const mergeQueries = (inner: string, appended: string): string => {
  if (inner === '') return appended;
  if (appended === '') return inner;
  return `${inner}&${appended}`;
};

const withQuery = (url: string, query: string): string => {
  if (query === '') return url;
  if (url.includes('?')) {
    return `${url}&${query}`;
  }
  return `${url}?${query}`;
};

const originOf = (target: InjectUrl): string => {
  const { hostname, port, protocol } = target;
  const host = hostname ?? 'localhost';
  const scheme = protocol ?? 'http:';
  if (port === undefined) {
    return `${scheme}//${host}`;
  }
  return `${scheme}//${host}:${port}`;
};

const toUrl = (target: string | InjectUrl, query: InjectQuery | undefined): string => {
  const appended = askedQuery(query);
  if (typeof target === 'string') {
    const url = new URL(target, ORIGIN);
    url.search = mergeQueries(url.search.slice(1), appended);
    return url.toString();
  }
  const { pathname, query: inner } = target;
  const merged = mergeQueries(askedQuery(inner), appended);
  return withQuery(`${originOf(target)}${pathname}`, merged);
};

const splitTarget = (target: string): Target => {
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
};

export { splitTarget, toUrl, toValues };

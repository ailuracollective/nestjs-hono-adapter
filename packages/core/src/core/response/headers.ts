import type { NestContext } from '#adapter/core/context';

/** The headers of an answer, as a plain record. */
type HeaderRecord = Record<string, string | string[]>;

/** What the `Response` constructor accepts for headers. */
type HeaderInit =
  | Record<string, string | readonly string[]>
  | [string, string][];

/** Adds one value to a header that may already carry some. */
const appendHeader = (
  headers: HeaderRecord,
  name: string,
  value: string,
): void => {
  const seen = headers[name];
  if (seen === undefined) {
    headers[name] = value;
  } else if (typeof seen === 'string') {
    headers[name] = [seen, value];
  } else {
    seen.push(value);
  }
};

/**
 * The pairs one header becomes, splitting a repeated
 * `set-cookie`.
 */
const headerPairs = (
  name: string,
  value: string | string[],
): [string, string][] => {
  if (typeof value === 'string') {
    return [[name, value]];
  }
  if (name === 'set-cookie') {
    return value.map((one): [string, string] => [name, one]);
  }
  return [[name, value.join(',')]];
};

/** The headers as something `Response` accepts. */
const headerInit = (headers: HeaderRecord): HeaderInit => {
  const cookies = headers['set-cookie'];
  if (typeof cookies !== 'object') {
    return headers;
  }
  return Object.entries(headers).flatMap(([name, value]) =>
    headerPairs(name, value),
  );
};

/** The headers already recorded on the context. */
const recordedHeaders = (
  context: NestContext,
): HeaderRecord => {
  const headers: HeaderRecord = {};
  for (const [name, value] of context.res.headers.entries()) {
    appendHeader(headers, name, value);
  }
  return headers;
};

/**
 * Labels the answer with the inferred type, unless one is
 * declared.
 */
const defaultContentType = (
  headers: HeaderRecord,
  inferred: string,
): void => {
  headers['content-type'] ??= inferred;
};

/** Reads a header value as a list of values. */
const toList = (
  value: string | readonly string[],
): readonly string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  return value;
};

/** Writes the disposition a file declares. */
const setDisposition = (
  headers: HeaderRecord,
  disposition: string | readonly string[],
): void => {
  for (const value of toList(disposition)) {
    appendHeader(headers, 'content-disposition', value);
  }
};

export {
  defaultContentType,
  headerInit,
  recordedHeaders,
  setDisposition,
};
export type { HeaderInit, HeaderRecord };

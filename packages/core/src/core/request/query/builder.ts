import { MAX_PAIRS, accepts, decode, repeated } from './names.ts';
import type { ParsedQuery } from './names.ts';

const MISSING = -1;

const addPair = (query: ParsedQuery, key: string, value: string): void => {
  if (!accepts(key)) return;
  query[key] = repeated(query[key], value);
};

const takePair = (query: ParsedQuery, source: string, start: number): number => {
  const separator = source.indexOf('&', start);
  const end = separator === MISSING ? source.length : separator;
  if (end > start) {
    const equalsInSegment = source.slice(start, end).indexOf('=');
    const equals = equalsInSegment === MISSING ? MISSING : start + equalsInSegment;
    const valued = equals !== MISSING && equals < end;
    addPair(
      query,
      decode(source.slice(start, valued ? equals : end)),
      valued ? decode(source.slice(equals + 1, end)) : '',
    );
  }
  return separator === MISSING ? MISSING : separator + 1;
};

// A range scan instead of `split('&')` and a tuple per pair: the query string is the hot path.
const parseQuery = (source: string): ParsedQuery => {
  const query: ParsedQuery = {};
  let index = source.startsWith('?') ? 1 : 0;
  let count = 0;
  while (index !== MISSING && index <= source.length && count < MAX_PAIRS) {
    index = takePair(query, source, index);
    count += 1;
  }
  return query;
};

export { parseQuery };

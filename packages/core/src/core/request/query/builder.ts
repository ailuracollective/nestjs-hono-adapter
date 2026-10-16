import { MAX_PAIRS, accepts, decode, repeated, sidesOf, withoutQuestionMark } from './names.ts';
import type { ParsedQuery } from './names.ts';

const addPair = (query: ParsedQuery, pair: string): void => {
  if (pair === '') return;
  const [name, value] = sidesOf(pair);
  const key = decode(name);
  if (!accepts(key)) {
    return;
  }
  query[key] = repeated(query[key], decode(value));
};

const parseQuery = (source: string): ParsedQuery => {
  const query: ParsedQuery = {};
  for (const pair of withoutQuestionMark(source).split('&').slice(0, MAX_PAIRS)) {
    addPair(query, pair);
  }
  return query;
};

export { parseQuery };

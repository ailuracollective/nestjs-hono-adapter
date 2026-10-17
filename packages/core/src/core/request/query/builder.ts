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
  const pairs = withoutQuestionMark(source).split('&');
  let count = 0;
  for (const pair of pairs) {
    if (count >= MAX_PAIRS) break;
    addPair(query, pair);
    count += 1;
  }
  return query;
};

export { parseQuery };

import {
  MAX_PAIRS,
  accepts,
  decode,
  repeated,
  sidesOf,
  withoutQuestionMark,
} from './names.ts';
import type { ParsedQuery } from './names.ts';

/** Builds a flat query object one pair at a time. */
class QueryBuilder {
  /** The object built so far. */
  private readonly query: ParsedQuery = {};

  /** Parses a query string into literal keys. */
  public parse(source: string): ParsedQuery {
    const pairs = withoutQuestionMark(source).split('&');
    for (const pair of pairs.slice(0, MAX_PAIRS)) {
      this.addPair(pair);
    }
    return this.query;
  }

  /** Adds one pair, a repeated name becoming a list. */
  private addPair(pair: string): void {
    if (pair === '') {
      return;
    }
    const [name, value] = sidesOf(pair);
    const key = decode(name);
    if (!accepts(key)) {
      return;
    }
    this.query[key] = repeated(this.query[key], decode(value));
  }
}

/** Parses a query string, with or without its leading `?`. */
const parseQuery = (source: string): ParsedQuery =>
  new QueryBuilder().parse(source);

export { parseQuery };

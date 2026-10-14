import { MAX_PAIRS, accepts, decode, repeated, sidesOf, withoutQuestionMark } from './names.ts';
import type { ParsedQuery } from './names.ts';

class QueryBuilder {
  private readonly query: ParsedQuery = {};

  public parse(source: string): ParsedQuery {
    const pairs = withoutQuestionMark(source).split('&');
    for (const pair of pairs.slice(0, MAX_PAIRS)) {
      this.addPair(pair);
    }
    return this.query;
  }

  private addPair(pair: string): void {
    if (pair === '') return;
    const [name, value] = sidesOf(pair);
    const key = decode(name);
    if (!accepts(key)) {
      return;
    }
    this.query[key] = repeated(this.query[key], decode(value));
  }
}

const parseQuery = (source: string): ParsedQuery => new QueryBuilder().parse(source);

export { parseQuery };

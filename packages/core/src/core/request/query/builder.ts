import {
  MAX_PAIRS,
  accepts,
  asList,
  asRecord,
  decode,
  isListStep,
  repeated,
  sidesOf,
  toNames,
  withoutQuestionMark,
} from './names.ts';
import type { ParsedQuery, Target } from './names.ts';

/** Builds the tree one pair at a time. */
class QueryBuilder {
  /** The tree built so far. */
  private readonly query: ParsedQuery = {};

  /** Parses a query string. */
  public parse(source: string): ParsedQuery {
    const pairs = withoutQuestionMark(source).split('&');
    for (const pair of pairs.slice(0, MAX_PAIRS)) {
      this.addPair(pair);
    }
    return this.query;
  }

  /** Adds one pair to the tree. */
  private addPair(pair: string): void {
    if (pair === '') {
      return;
    }
    const [name, value] = sidesOf(pair);
    const names = toNames(decode(name));
    if (!accepts(names)) {
      return;
    }
    this.assign(this.query, { names, value: decode(value) });
  }

  /** Assigns one target into a container. */
  private assign(
    container: Record<string, unknown>,
    target: Target,
  ): void {
    const [name, ...rest] = target.names;
    if (name === undefined) {
      return;
    }
    if (rest.length === 0) {
      container[name] = repeated(container[name], target.value);
      return;
    }
    this.assignDeeper(container, name, {
      names: rest,
      value: target.value,
    });
  }

  /** Assigns a target with more than one name left. */
  private assignDeeper(
    container: Record<string, unknown>,
    name: string,
    target: Target,
  ): void {
    const [next] = target.names;
    if (isListStep(next ?? '')) {
      this.assignList(container, name, target);
      return;
    }
    this.assignRecord(container, name, target);
  }

  /** Assigns a target into a list step. */
  private assignList(
    container: Record<string, unknown>,
    name: string,
    target: Target,
  ): void {
    const list = asList(container[name]);
    container[name] = list;
    this.intoList(list, target);
  }

  /** Assigns a target into an object step. */
  private assignRecord(
    container: Record<string, unknown>,
    name: string,
    target: Target,
  ): void {
    const existing = container[name];
    if (Array.isArray(existing)) {
      const nested: Record<string, unknown> = {};
      existing.push(nested);
      this.assign(nested, target);
      return;
    }
    container[name] = this.written(existing, target);
  }

  /** Walks the rest of a target's names inside a list. */
  private intoList(list: unknown[], target: Target): void {
    const [name, ...rest] = target.names;
    if (name === undefined) {
      return;
    }
    this.place(list, name, {
      names: rest,
      value: target.value,
    });
  }

  /** The one write into a list. */
  private place(
    list: unknown[],
    name: string,
    target: Target,
  ): void {
    let index = list.length;
    if (name !== '') {
      index = Number(name);
    }
    if (!Number.isSafeInteger(index) || index < 0) {
      return;
    }
    list[index] = this.written(list[index], target);
  }

  /** What a target leaves in a slot. */
  private written(existing: unknown, target: Target): unknown {
    const [next] = target.names;
    if (next === undefined) {
      return repeated(existing, target.value);
    }
    if (isListStep(next)) {
      const nested = asList(existing);
      this.intoList(nested, target);
      return nested;
    }
    const nested = asRecord(existing);
    this.assign(nested, target);
    return nested;
  }
}

/** Parses a query string, with or without its leading `?`. */
const parseQuery = (source: string): ParsedQuery =>
  new QueryBuilder().parse(source);

export { parseQuery };

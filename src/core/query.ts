/**
 * A query string parsed into the shape a controller receives:
 * every leaf is a string, and a name that appears more than
 * once or uses brackets becomes a list or a nested object.
 */
type ParsedQuery = Record<string, unknown>;

/**
 * Names that reach the prototype chain. A parser that writes
 * them hands a caller control over every object in the process,
 * so they are dropped instead.
 */
const FORBIDDEN_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const INDEX = /^\d+$/u;
const BRACKETS = /\[(?<name>[^\]]*)\]/gu;
const MISSING = -1;

/** One assignment: the names still to walk and the value. */
interface Target {
  readonly names: readonly string[];
  readonly value: string;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  return {};
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/**
 * Says whether the next segment builds a list: `[]` appends,
 * and a number indexes.
 */
function isListStep(name: string): boolean {
  return name === '' || INDEX.test(name);
}

/**
 * Decodes one side of a pair. A sequence that is not valid
 * percent-encoding is kept as it arrived, which is what the
 * platform parsers do rather than refusing the request.
 */
function decode(value: string): string {
  const spaced = value.replaceAll('+', ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/**
 * Splits `filter[name][]` into `['filter', 'name', '']`. A name
 * without brackets is its own single segment.
 */
function toNames(name: string): string[] {
  const first = name.indexOf('[');
  if (first === MISSING) {
    return [name];
  }
  const names = [name.slice(0, first)];
  for (const match of name.slice(first).matchAll(BRACKETS)) {
    const groups = match.groups ?? {};
    names.push(groups.name ?? '');
  }
  return names;
}

/**
 * Adds a value to a name that may already hold one. The second
 * value turns the entry into a list, which is how a repeated
 * name is read.
 */
function repeated(current: unknown, value: string): unknown {
  if (current === undefined) {
    return value;
  }
  if (Array.isArray(current)) {
    current.push(value);
    return current;
  }
  return [current, value];
}

function sidesOf(pair: string): readonly [string, string] {
  const separator = pair.indexOf('=');
  if (separator === MISSING) {
    return [pair, ''];
  }
  return [pair.slice(0, separator), pair.slice(separator + 1)];
}

function withoutQuestionMark(source: string): string {
  if (source.startsWith('?')) {
    return source.slice(1);
  }
  return source;
}

function accepts(names: readonly string[]): boolean {
  if (names.length === 0) {
    return false;
  }
  return !names.some((segment) => FORBIDDEN_NAMES.has(segment));
}

/**
 * Builds the tree one pair at a time.
 *
 * A step whose next name is `[]` or a number builds a list, and
 * every other step builds an object; the methods below are
 * split along that decision so each one stays readable on its
 * own.
 */
class QueryBuilder {
  private readonly query: ParsedQuery = {};

  public parse(source: string): ParsedQuery {
    for (const pair of withoutQuestionMark(source).split('&')) {
      this.addPair(pair);
    }
    return this.query;
  }

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

  private assignList(
    container: Record<string, unknown>,
    name: string,
    target: Target,
  ): void {
    const list = asList(container[name]);
    container[name] = list;
    this.intoList(list, target);
  }

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
    container[name] = this.toRecord(existing, target);
  }

  private intoList(list: unknown[], target: Target): void {
    const [name, ...rest] = target.names;
    if (name === undefined) {
      return;
    }
    const nested = { names: rest, value: target.value };
    if (name === '') {
      this.addElement(list, nested);
      return;
    }
    this.addIndex(list, name, nested);
  }

  private addIndex(
    list: unknown[],
    name: string,
    target: Target,
  ): void {
    const index = Number(name);
    if (!Number.isSafeInteger(index) || index < 0) {
      return;
    }
    this.addAt(list, index, target);
  }

  private addElement(list: unknown[], target: Target): void {
    const [next] = target.names;
    if (next === undefined) {
      list.push(target.value);
      return;
    }
    if (isListStep(next)) {
      const nested: unknown[] = [];
      list.push(nested);
      this.intoList(nested, target);
      return;
    }
    list.push(this.toRecord(undefined, target));
  }

  private addAt(
    list: unknown[],
    index: number,
    target: Target,
  ): void {
    const existing = list[index];
    if (target.names.length === 0) {
      list[index] = repeated(existing, target.value);
      return;
    }
    const [next] = target.names;
    if (isListStep(next ?? '')) {
      list[index] = this.toList(existing, target);
      return;
    }
    list[index] = this.toRecord(existing, target);
  }

  private toList(existing: unknown, target: Target): unknown[] {
    const nested = asList(existing);
    this.intoList(nested, target);
    return nested;
  }

  private toRecord(
    existing: unknown,
    target: Target,
  ): Record<string, unknown> {
    const nested = asRecord(existing);
    this.assign(nested, target);
    return nested;
  }
}

/**
 * Parses a query string, with or without its leading `?`.
 *
 * Repeated names become lists, `name[]` appends, `name[0]`
 * indexes and `name[child]` nests; anything else is a string.
 * The grammar is the one the platform parsers accept, which is
 * what a controller written against Express or Fastify expects
 * to read.
 */
function parseQuery(source: string): ParsedQuery {
  return new QueryBuilder().parse(source);
}

export { parseQuery };
export type { ParsedQuery };

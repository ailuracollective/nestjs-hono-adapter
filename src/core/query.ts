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

/**
 * The two ceilings this parser holds to, and they are `qs`'s
 * own because the grammar here is the one `qs` accepts: a
 * string `qs` would flatten or drop has to flatten or drop here
 * too, and these are the numbers `qs` has always defaulted to.
 * Without them a crafted query string, in the url or in an
 * urlencoded body, buys unbounded stack and unbounded pairs
 * inside the request path.
 *
 * Past the depth the run folds into one literal key rather than
 * being refused, and past the parameter ceiling the rest of the
 * pairs are ignored, because that is how `qs` answers with its
 * defaults (`strictDepth` and `throwOnLimitExceeded` are both
 * `false`) and no official adapter refuses a query at all:
 * `platform-express` never parses it, handing Express 5 its
 * `simple` `querystring.parse`, and `platform-fastify` uses
 * `fast-querystring` — both flat, so neither can exceed a
 * limit. A 400 here would be this adapter inventing a refusal
 * and would break clients migrating from Express 4, whose `qs`
 * truncates exactly this way.
 *
 * `qs`'s `arrayLimit` is deliberately not copied. It arrived as
 * a regression that collapsed long repeated keys into objects
 * and broke Express consumers, so a repeated name stays a list
 * here however long it grows. Its `allowPrototypes` is not
 * copied either: `FORBIDDEN_NAMES` above is the safer default
 * and is already what `qs` does.
 */
const MAX_DEPTH = 5;
const MAX_PAIRS = 1000;

/** One assignment: the names still to walk and the value. */
interface Target {
  readonly names: readonly string[];
  readonly value: string;
}

/**
 * Says whether a value is the plain object a nested name
 * builds. Arrays are excluded because a bracket that indexes
 * builds a list instead.
 */
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
 * The names past the depth ceiling, kept as one literal key
 * with their brackets read back, which is what `qs` leaves
 * behind once it stops descending: in a run of nine segments
 * `alpha` through `epsilon` stay nested and everything after
 * them becomes the single key `'[zeta][eta][theta][iota]'`.
 */
function withinDepth(names: string[]): string[] {
  const rest = names.slice(MAX_DEPTH);
  if (rest.length === 0) {
    return names;
  }
  const tail = rest.map((name) => `[${name}]`).join('');
  return [...names.slice(0, MAX_DEPTH), tail];
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
  return withinDepth(names);
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
 * Builds the tree one pair at a time, up to the pair ceiling.
 *
 * A step whose next name is `[]` or a number builds a list, and
 * every other step builds an object; the methods below are
 * split along that decision so each one stays readable on its
 * own.
 */
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
    container[name] = this.written(existing, target);
  }

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

  /**
   * The one write into a list. An empty name appends at the end
   * and any other name has to read as a safe non-negative
   * index, so a single slot decides both and the two walks that
   * used to differ only in that choice are gone. A name that
   * reads as no such index drops the pair, which is what a
   * bracket holding nonsense has always meant here.
   */
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

  /**
   * What a target leaves in a slot: the value itself once no
   * name is left to walk, otherwise the list or the object its
   * next name calls for. The container is filled in place,
   * which is how a later pair finds it again.
   */
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

/**
 * Parses a query string, with or without its leading `?`.
 *
 * Repeated names become lists, `name[]` appends, `name[0]`
 * indexes and `name[child]` nests; anything else is a string.
 * The grammar is the one the platform parsers accept, which is
 * what a controller written against Express or Fastify expects
 * to read. Nothing here is ever refused: past `MAX_DEPTH` the
 * remaining brackets become one literal key, and past
 * `MAX_PAIRS` the remaining pairs are ignored.
 */
function parseQuery(source: string): ParsedQuery {
  return new QueryBuilder().parse(source);
}

export { isRecord, parseQuery };
export type { ParsedQuery };

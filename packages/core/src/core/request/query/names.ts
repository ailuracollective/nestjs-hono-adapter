/** A parsed query string, whose leaves are strings. */
type ParsedQuery = Record<string, unknown>;

/** The names that reach the prototype chain and are dropped. */
const FORBIDDEN_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** A name that indexes a list. */
const INDEX = /^\d+$/u;
/** A bracketed name segment. */
const BRACKETS = /\[(?<name>[^\]]*)\]/gu;
/** The index a search of a string did not find. */
const MISSING = -1;

/** The deepest name the parser descends to. */
const MAX_DEPTH = 5;
/** The most pairs the parser reads. */
const MAX_PAIRS = 1000;

/** One assignment: the names still to walk and the value. */
interface Target {
  readonly names: readonly string[];
  readonly value: string;
}

/** Whether a value is a plain object a nested name builds. */
const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

/** The value as a record, or an empty one. */
const asRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }
  return {};
};

/** The value as a list, or an empty one. */
const asList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

/** Whether the next segment builds a list. */
const isListStep = (name: string): boolean =>
  name === '' || INDEX.test(name);

/** Decodes one side of a pair. */
const decode = (value: string): string => {
  const spaced = value.replaceAll('+', ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
};

/** The names past the depth ceiling, kept as one key. */
const withinDepth = (names: string[]): string[] => {
  const rest = names.slice(MAX_DEPTH);
  if (rest.length === 0) {
    return names;
  }
  const tail = rest.map((name) => `[${name}]`).join('');
  return [...names.slice(0, MAX_DEPTH), tail];
};

/** Splits a bracketed name into its segments. */
const toNames = (name: string): string[] => {
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
};

/** Adds a value to a name that may already hold one. */
const repeated = (current: unknown, value: string): unknown => {
  if (current === undefined) {
    return value;
  }
  if (Array.isArray(current)) {
    current.push(value);
    return current;
  }
  return [current, value];
};

/** Splits a pair on its first `=`. */
const sidesOf = (pair: string): readonly [string, string] => {
  const separator = pair.indexOf('=');
  if (separator === MISSING) {
    return [pair, ''];
  }
  return [pair.slice(0, separator), pair.slice(separator + 1)];
};

/** The source without its leading `?`. */
const withoutQuestionMark = (source: string): string => {
  if (source.startsWith('?')) {
    return source.slice(1);
  }
  return source;
};

/** Whether a name list is free of the forbidden names. */
const accepts = (names: readonly string[]): boolean => {
  if (names.length === 0) {
    return false;
  }
  return !names.some((segment) => FORBIDDEN_NAMES.has(segment));
};

export {
  MAX_PAIRS,
  accepts,
  asList,
  asRecord,
  decode,
  isListStep,
  isRecord,
  repeated,
  sidesOf,
  toNames,
  withoutQuestionMark,
};

export type { ParsedQuery, Target };

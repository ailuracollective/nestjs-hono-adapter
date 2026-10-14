/** A parsed query string, whose leaves are strings. */
type ParsedQuery = Record<string, unknown>;

/** The names that reach the prototype chain and are dropped. */
const FORBIDDEN_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** The index a search of a string did not find. */
const MISSING = -1;

/** The most pairs the parser reads. */
const MAX_PAIRS = 1000;

/** Whether a value is a plain object a nested name builds. */
const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

/** Decodes one side of a pair. */
const decode = (value: string): string => {
  const spaced = value.replaceAll('+', ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
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

/** Whether a name is free of the forbidden names. */
const accepts = (name: string): boolean =>
  !FORBIDDEN_NAMES.has(name);

export {
  MAX_PAIRS,
  accepts,
  decode,
  isRecord,
  repeated,
  sidesOf,
  withoutQuestionMark,
};
export type { ParsedQuery };

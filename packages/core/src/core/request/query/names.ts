type ParsedQuery = Record<string, unknown>;

const FORBIDDEN_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

const MISSING = -1;

const MAX_PAIRS = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decode = (value: string): string => {
  const spaced = value.replaceAll('+', ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
};

const repeated = (current: unknown, value: string): unknown => {
  if (current === undefined) return value;
  if (Array.isArray(current)) {
    current.push(value);
    return current;
  }
  return [current, value];
};

const sidesOf = (pair: string): readonly [string, string] => {
  const separator = pair.indexOf('=');
  if (separator === MISSING) return [pair, ''];
  return [pair.slice(0, separator), pair.slice(separator + 1)];
};

const withoutQuestionMark = (source: string): string => {
  if (source.startsWith('?')) {
    return source.slice(1);
  }
  return source;
};

const accepts = (name: string): boolean => !FORBIDDEN_NAMES.has(name);

export { MAX_PAIRS, accepts, decode, isRecord, repeated, sidesOf, withoutQuestionMark };
export type { ParsedQuery };

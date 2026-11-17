type ParsedQuery = Record<string, unknown>;

const FORBIDDEN_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

const MAX_PAIRS = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decode = (value: string): string => {
  // Most query tokens carry nothing to decode; `decodeURIComponent` is the expensive half.
  if (!value.includes('%') && !value.includes('+')) return value;
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

const accepts = (name: string): boolean => !FORBIDDEN_NAMES.has(name);

export { MAX_PAIRS, accepts, decode, isRecord, repeated };
export type { ParsedQuery };

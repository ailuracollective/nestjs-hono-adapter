interface PathStep {
  type: 'object' | 'array';
  key: string | number;
  last?: boolean;
  append?: boolean;
  nextType?: 'object' | 'array';
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const parsePath = (key: string): PathStep[] => {
  const failure = (): PathStep[] => [{ type: 'object', key, last: true }];
  const first = /^[^[]*/u.exec(key)?.[0] ?? '';
  if (first === '') return failure();

  let position = first.length;
  let tail: PathStep = { type: 'object', key: first };
  const steps: PathStep[] = [tail];

  while (position < key.length) {
    if (key[position] === '[' && key[position + 1] === ']') {
      position += 2;
      tail.append = true;
      if (position !== key.length) return failure();
      continue;
    }
    const rest = key.slice(position);
    const indexed = /^\[(\d+)\]/u.exec(rest);
    if (indexed !== null) {
      position += indexed[0].length;
      tail.nextType = 'array';
      tail = {
        type: 'array',
        key: Number.parseInt(indexed[1] ?? '', 10),
      };
      steps.push(tail);
      continue;
    }
    const named = /^\[([^\]]+)\]/u.exec(rest);
    if (named !== null) {
      position += named[0].length;
      tail.nextType = 'object';
      tail = { type: 'object', key: named[1] ?? '' };
      steps.push(tail);
      continue;
    }
    return failure();
  }
  tail.last = true;
  return steps;
};

const valueType = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') return 'object';
  return 'scalar';
};

const setLastValue = (
  context: Record<string, unknown>,
  step: PathStep,
  current: unknown,
  value: unknown,
): Record<string, unknown> => {
  switch (valueType(current)) {
    case 'undefined':
      context[step.key] = step.append === true ? [value] : value;
      break;
    case 'array':
      (context[step.key] as unknown[]).push(value);
      break;
    case 'object':
      return setLastValue(
        current as Record<string, unknown>,
        { type: 'object', key: '', last: true },
        (current as Record<string, unknown>)[''],
        value,
      );
    default:
      context[step.key] = [context[step.key], value];
      break;
  }
  return context;
};

const setValue = (
  context: Record<string, unknown>,
  step: PathStep,
  current: unknown,
  value: unknown,
): Record<string, unknown> => {
  if (step.last === true) return setLastValue(context, step, current, value);
  let object: Record<string, unknown>;
  switch (valueType(current)) {
    case 'undefined':
      context[step.key] = step.nextType === 'array' ? [] : Object.create(null);
      return context[step.key] as Record<string, unknown>;
    case 'object':
      return current as Record<string, unknown>;
    case 'array':
      if (step.nextType === 'array') return current as unknown as Record<string, unknown>;
      object = Object.create(null);
      context[step.key] = object;
      (current as unknown[]).forEach((item, index) => {
        if (item !== undefined) {
          object[`${index}`] = item;
        }
      });
      return object;
    default:
      object = Object.create(null);
      object[''] = current;
      context[step.key] = object;
      return object;
  }
};

const appendField = (store: Record<string, unknown>, key: string, value: unknown): boolean => {
  const steps = parsePath(key);
  if (steps.some((step) => FORBIDDEN_KEYS.has(String(step.key)))) {
    return false;
  }
  steps.reduce<Record<string, unknown>>(
    (context, step) => setValue(context, step, context[step.key], value),
    store,
  );
  return true;
};

export { appendField };

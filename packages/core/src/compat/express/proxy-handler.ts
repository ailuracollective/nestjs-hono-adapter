import type { NestContext } from '#adapter/core/context';
import { writer } from './surface.ts';

const HIDDEN = 'set';

const isCallable = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';

const proxyHandler = (
  context: NestContext,
  overrides: Map<string, unknown>,
  readers: Record<string, unknown>,
): ProxyHandler<Record<string, unknown>> => ({
  get(target, property): unknown {
    if (typeof property !== 'string') return Reflect.get(target, property);
    if (property === HIDDEN) return undefined;
    if (overrides.has(property)) return overrides.get(property);
    if (Object.hasOwn(readers, property)) return readers[property];
    const value = Reflect.get(target, property);
    return isCallable(value) ? value.bind(context) : value;
  },
  has(target, property): boolean {
    if (typeof property !== 'string') return Reflect.has(target, property);
    return property !== HIDDEN && Reflect.has(target, property);
  },
  set(target, property, value): boolean {
    if (property === 'writeHead') {
      overrides.set(property, value);
      return true;
    }
    if (property === 'statusCode' && typeof value === 'number') {
      writer.status(context, value);
      return true;
    }
    return Reflect.set(target, property, value);
  },
});

export { HIDDEN, isCallable, proxyHandler };

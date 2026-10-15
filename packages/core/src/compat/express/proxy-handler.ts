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
    if (!isCallable(value)) return value;
    // Hono keeps its members as instance fields already bound to the context; only a prototype
    // method needs binding, or `this` would be the proxy and lose the private fields.
    return Object.hasOwn(target, property) ? value : value.bind(context);
  },
  has(target, property): boolean {
    if (typeof property !== 'string') return Reflect.has(target, property);
    return property !== HIDDEN && Reflect.has(target, property);
  },
  set(target, property, value): boolean {
    if (typeof property !== 'string') return Reflect.set(target, property, value);
    if (property === 'writeHead') {
      overrides.set(property, value);
      return true;
    }
    if (property === 'statusCode' && typeof value === 'number') {
      writer.status(context, value);
      return true;
    }
    if (Reflect.set(target, property, value)) return true;
    overrides.set(property, value);
    return true;
  },
});

export { HIDDEN, isCallable, proxyHandler };

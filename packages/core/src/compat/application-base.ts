import { processCall } from './peer-runtime.ts';

/**
 * Where the **application** is, as far as a module lookup is concerned — `peer-load.ts` says why a
 * bare import is not it.
 */

type Resolver = (specifier: string) => string;

interface Require {
  readonly resolve: Resolver;
}

const isCarrier = (value: unknown): value is Record<PropertyKey, unknown> =>
  (typeof value === 'object' && value !== null) || typeof value === 'function';

const isRequireFactory = (value: unknown): value is (anchor: string) => Require =>
  typeof value === 'function';

const requireFactory = (): ((anchor: string) => Require) | undefined => {
  const builtin = processCall('getBuiltinModule', 'node:module');
  const factory: unknown = Reflect.get(isCarrier(builtin) ? builtin : {}, 'createRequire');
  return isRequireFactory(factory) ? factory : undefined;
};

const workingDirectory = (): string | undefined => {
  const directory = processCall('cwd');
  return typeof directory === 'string' && directory !== '' ? directory : undefined;
};

const applicationResolver = (): Resolver | undefined => {
  const directory = workingDirectory();
  const create = directory === undefined ? undefined : requireFactory();
  if (directory === undefined || create === undefined) return undefined;
  try {
    const bound = create(`${directory}/package.json`);
    return typeof bound.resolve === 'function' ? bound.resolve : undefined;
  } catch {
    return undefined;
  }
};

export { applicationResolver, workingDirectory };
export type { Require, Resolver };

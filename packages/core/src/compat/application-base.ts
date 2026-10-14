import { processCall } from './peer-runtime.ts';

/**
 * Where the **application** is, as far as a module lookup is
 * concerned — `peer-load.ts` says why a bare import is not it.
 */

/** What a resolver answers: the file a specifier names. */
type Resolver = (specifier: string) => string;

/** What `createRequire` hands back, narrowed to what is used. */
interface Require {
  readonly resolve: Resolver;
}

/**
 * Whether members can be read off a value: Node answers a
 * namespace, Bun the module.
 */
const isCarrier = (
  value: unknown,
): value is Record<PropertyKey, unknown> =>
  (typeof value === 'object' && value !== null) ||
  typeof value === 'function';

/** Whether a value builds a `require` bound to an anchor. */
const isRequireFactory = (
  value: unknown,
): value is (anchor: string) => Require =>
  typeof value === 'function';

/**
 * `createRequire`, read out of the global so the region names
 * no runtime.
 */
const requireFactory = ():
  | ((anchor: string) => Require)
  | undefined => {
  const builtin = processCall(
    'getBuiltinModule',
    'node:module',
  );
  const factory: unknown = Reflect.get(
    isCarrier(builtin) ? builtin : {},
    'createRequire',
  );
  return isRequireFactory(factory) ? factory : undefined;
};

/** The directory the application was started from. */
const workingDirectory = (): string | undefined => {
  const directory = processCall('cwd');
  return typeof directory === 'string' && directory !== ''
    ? directory
    : undefined;
};

/**
 * `resolve`, bound where the application is; a resolver walks
 * up from the anchor.
 */
const applicationResolver = (): Resolver | undefined => {
  const directory = workingDirectory();
  const create =
    directory === undefined ? undefined : requireFactory();
  if (directory === undefined || create === undefined) {
    return undefined;
  }
  try {
    const bound = create(`${directory}/package.json`);
    return typeof bound.resolve === 'function'
      ? bound.resolve
      : undefined;
  } catch {
    return undefined;
  }
};

export { applicationResolver, workingDirectory };
export type { Require, Resolver };

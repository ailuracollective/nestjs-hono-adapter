const runtimeProcess = (): object | undefined => {
  const value: unknown = Reflect.get(globalThis, 'process');
  return typeof value === 'object' && value !== null ? value : undefined;
};

/**
 * A member of `process`, called with the one argument it is given. `Reflect` throughout: `process`
 * carries no type here.
 */
const processCall = (name: string, argument?: string): unknown => {
  const member: unknown = Reflect.get(runtimeProcess() ?? {}, name);
  if (typeof member !== 'function') return undefined;
  const args = argument === undefined ? [] : [argument];
  return Reflect.apply(member, undefined, args);
};

export { processCall, runtimeProcess };

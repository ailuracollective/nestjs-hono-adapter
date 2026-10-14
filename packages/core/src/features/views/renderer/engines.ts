import type { ViewData, ViewEngine } from '#adapter/features/views/types';

type Callable = (source: string, data: ViewData) => unknown;

const isCallable = (value: unknown): value is Callable => typeof value === 'function';

const defaultOf = (loaded: unknown): unknown =>
  typeof loaded === 'object' && loaded !== null ? Reflect.get(loaded, 'default') : undefined;

const callableOf = (holder: unknown, name: string): Callable | undefined => {
  if (typeof holder !== 'object' || holder === null) return undefined;
  const held: unknown = Reflect.get(holder, name);
  return isCallable(held) ? held : undefined;
};

const asHtml = async (value: unknown): Promise<string> => String(await value);

/**
 * Adapts a loaded module to the renderer's contract: the module, or its default, is a `(source,
 * data)` function or carries a `render`.
 */
const adaptEngine = (loaded: unknown): ViewEngine | undefined => {
  for (const candidate of [loaded, defaultOf(loaded)]) {
    if (isCallable(candidate)) {
      return (source, data) => asHtml(candidate(source, data));
    }
    const render = callableOf(candidate, 'render');
    if (render !== undefined) return (source, data) => asHtml(render.call(candidate, source, data));
  }
  return undefined;
};

const loadModule = async (name: string): Promise<unknown> => {
  try {
    const loaded: unknown = await import(name);
    return loaded;
  } catch (error) {
    throw new TypeError(`The view engine "${name}" could not be loaded: ${String(error)}`, {
      cause: error,
    });
  }
};

const resolveEngine = async (name: string): Promise<ViewEngine> => {
  const engine = adaptEngine(await loadModule(name));
  if (engine === undefined) {
    throw new TypeError(
      `The view engine "${name}" answers no render the adapter can ` +
        'call; pass `views.engine` instead.',
    );
  }
  return engine;
};

export { adaptEngine, resolveEngine };

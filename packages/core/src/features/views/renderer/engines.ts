import type {
  ViewData,
  ViewEngine,
} from '#adapter/features/views/types';

/** A source-based render one loaded module may carry. */
type Callable = (source: string, data: ViewData) => unknown;

/**
 * Says whether a value is the source-based render the adapter
 * calls.
 */
const isCallable = (value: unknown): value is Callable =>
  typeof value === 'function';

/** The default export of a loaded module, if it has one. */
const defaultOf = (loaded: unknown): unknown =>
  typeof loaded === 'object' && loaded !== null
    ? Reflect.get(loaded, 'default')
    : undefined;

/**
 * The callable a holder carries under a name, if it carries
 * one.
 */
const callableOf = (
  holder: unknown,
  name: string,
): Callable | undefined => {
  if (typeof holder !== 'object' || holder === null) {
    return undefined;
  }
  const held: unknown = Reflect.get(holder, name);
  return isCallable(held) ? held : undefined;
};

/** Coerces whatever a render answered into the answer's HTML. */
const asHtml = async (value: unknown): Promise<string> =>
  String(await value);

/**
 * Adapts a loaded module to the renderer's contract: the
 * module, or its default, is a `(source, data)` function or
 * carries a `render`.
 */
const adaptEngine = (
  loaded: unknown,
): ViewEngine | undefined => {
  for (const candidate of [loaded, defaultOf(loaded)]) {
    if (isCallable(candidate)) {
      return (source, data) => asHtml(candidate(source, data));
    }
    const render = callableOf(candidate, 'render');
    if (render !== undefined) {
      return (source, data) =>
        asHtml(render.call(candidate, source, data));
    }
  }
  return undefined;
};

/** Loads one engine module, naming it in the failure. */
const loadModule = async (name: string): Promise<unknown> => {
  try {
    const loaded: unknown = await import(name);
    return loaded;
  } catch (error) {
    throw new TypeError(
      `The view engine "${name}" could not be loaded: ${String(error)}`,
      { cause: error },
    );
  }
};

/** Loads a named view engine and adapts it. */
const resolveEngine = async (
  name: string,
): Promise<ViewEngine> => {
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

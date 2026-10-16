import { rendererOf } from '#adapter/features/views/engine-value';

import type { Renderer } from '#adapter/features/views/types';

const defaultOf = (loaded: unknown): unknown =>
  typeof loaded === 'object' && loaded !== null ? Reflect.get(loaded, 'default') : undefined;

/**
 * Adapts a loaded module to the renderer's contract: the module, or its default, is a `(source,
 * data)` function, an Express engine `(filePath, options, callback)`, or carries one as `render`.
 */
const adaptEngine = (loaded: unknown): Renderer | undefined => {
  for (const candidate of [loaded, defaultOf(loaded)]) {
    const renderer = rendererOf(candidate, 'source');
    if (renderer !== undefined) return renderer;
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

const resolveEngine = async (name: string): Promise<Renderer> => {
  const engine = adaptEngine(await loadModule(name));
  if (engine === undefined) {
    throw new TypeError(
      `The view engine "${name}" answers no render the adapter can call: ` +
        'write it as (source, data) or as an Express engine ' +
        '(filePath, options, callback), or pass views.engine.',
    );
  }
  return engine;
};

export { adaptEngine, resolveEngine };

import { isRecord } from '#adapter/core/request/query/index';
import type {
  ViewData,
  ViewEngine,
} from '#adapter/features/views/types';

/** Whether an engine is the renderer this adapter calls. */
const isEngine = (value: unknown): value is ViewEngine =>
  typeof value === 'function';

/** Whether an engine renders from the source, as `render` does. */
const isRenderEngine = (
  value: unknown,
): value is { render: ViewEngine } =>
  isRecord(value) && typeof value.render === 'function';

/** The one renderer such a configuration names. */
const namedEngine = (
  engines: Readonly<Record<string, unknown>>,
): unknown => {
  const named = Object.values(engines);
  if (named.length !== 1) {
    throw new TypeError(
      'setViewEngine() renders with one engine, so name one.',
    );
  }

  return named[0];
};

/** The renderer a named engine is, when it renders from source. */
const asEngine = (engine: unknown): ViewEngine => {
  if (isEngine(engine)) {
    return engine;
  }
  if (isRenderEngine(engine)) {
    return (
      source: string,
      data: ViewData,
    ): string | Promise<string> => engine.render(source, data);
  }

  throw new TypeError(
    'setViewEngine() renders from the template source, so an ' +
      'engine must be a function of (source, data) or expose ' +
      'that as render().',
  );
};

/** The renderer such a configuration names. */
const engineFrom = (
  engines: Readonly<Record<string, unknown>> | undefined,
): ViewEngine | undefined => {
  if (engines === undefined) {
    return undefined;
  }

  return asEngine(namedEngine(engines));
};

export { engineFrom };

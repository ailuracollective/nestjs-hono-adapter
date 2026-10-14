import { isRecord } from '#adapter/core/request/query/index';
import type { ViewData, ViewEngine } from '#adapter/features/views/types';

const isEngine = (value: unknown): value is ViewEngine => typeof value === 'function';

const isRenderEngine = (value: unknown): value is { render: ViewEngine } =>
  isRecord(value) && typeof value.render === 'function';

const namedEngine = (engines: Readonly<Record<string, unknown>>): unknown => {
  const named = Object.values(engines);
  if (named.length !== 1)
    throw new TypeError('setViewEngine() renders with one engine, so name one.');

  return named[0];
};

const asEngine = (engine: unknown): ViewEngine => {
  if (isEngine(engine)) {
    return engine;
  }
  if (isRenderEngine(engine)) {
    return (source: string, data: ViewData): string | Promise<string> =>
      engine.render(source, data);
  }

  throw new TypeError(
    'setViewEngine() renders from the template source, so an ' +
      'engine must be a function of (source, data) or expose ' +
      'that as render().',
  );
};

const engineFrom = (
  engines: Readonly<Record<string, unknown>> | undefined,
): ViewEngine | undefined => {
  if (engines === undefined) return undefined;

  return asEngine(namedEngine(engines));
};

export { engineFrom };

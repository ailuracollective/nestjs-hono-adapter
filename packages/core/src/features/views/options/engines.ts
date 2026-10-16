import { rendererOf } from '#adapter/features/views/engine-value';

import type { Renderer } from '#adapter/features/views/types';

const namedEngine = (engines: Readonly<Record<string, unknown>>): unknown => {
  const named = Object.values(engines);
  if (named.length !== 1)
    throw new TypeError('setViewEngine() renders with one engine, so name one.');

  return named[0];
};

const engineFrom = (
  engines: Readonly<Record<string, unknown>> | undefined,
): Renderer | undefined => {
  if (engines === undefined) return undefined;

  const engine = rendererOf(namedEngine(engines), 'source');
  if (engine === undefined) {
    throw new TypeError(
      'setViewEngine() renders with a template engine, so it must be a function of ' +
        '(source, data), an Express engine of (filePath, options, callback), or carry one as render().',
    );
  }

  return engine;
};

export { engineFrom };

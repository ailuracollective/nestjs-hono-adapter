import { toExtension } from '#adapter/features/views/files';
import {
  directoriesFrom,
  engineFrom,
} from '#adapter/features/views/options';

import type { ViewState } from './data.ts';
import type {
  ViewEngine,
  ViewEngineOptions,
} from '#adapter/features/views/types';

/** Reads the names such a configuration carries onto the views. */
const applyNames = (
  state: ViewState,
  options: ViewEngineOptions,
): void => {
  if (options.viewExt !== undefined) {
    state.extension = toExtension(options.viewExt);
  }
  if (options.defaultContext !== undefined) {
    state.defaults = options.defaultContext;
  }
};

/** Reads the fields such a configuration names onto the views. */
const applyConfig = (
  state: ViewState,
  options: ViewEngineOptions,
): void => {
  const engine = engineFrom(options.engine);
  if (engine !== undefined) {
    state.engine = engine;
  }
  const directories = directoriesFrom(options);
  if (directories.length > 0) {
    state.directories = directories;
  }

  applyNames(state, options);
};

/**
 * The extension a name renders by, or a throw when no engine is
 * set.
 */
const extensionFor = (
  engine: ViewEngine | undefined,
  name: string,
): string => {
  if (engine === undefined) {
    throw new TypeError(
      'The adapter renders with the engine it was given, so ' +
        'pass `views.engine` before naming one.',
    );
  }
  return toExtension(name);
};

export { applyConfig, extensionFor };

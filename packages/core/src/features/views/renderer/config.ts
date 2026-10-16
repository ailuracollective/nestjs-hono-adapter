import { toExtension } from '#adapter/features/views/files';
import { directoriesFrom, engineFrom } from '#adapter/features/views/options';

import type { ViewState } from './data.ts';
import type { ViewEngineOptions } from '#adapter/features/views/types';

const applyNames = (state: ViewState, options: ViewEngineOptions): void => {
  if (options.viewExt !== undefined) state.extension = toExtension(options.viewExt);
  if (options.defaultContext !== undefined) state.defaults = options.defaultContext;
};

const applyConfig = (state: ViewState, options: ViewEngineOptions): void => {
  const engine = engineFrom(options.engine);
  if (engine !== undefined) state.engine = engine;
  const directories = directoriesFrom(options);
  if (directories.length > 0) state.directories = directories;

  applyNames(state, options);
};

const extensionFor = (name: string): string => toExtension(name);

export { applyConfig, extensionFor };

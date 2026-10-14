import {
  fileNameFor,
  readFrom,
} from '#adapter/features/views/files';

import { asData, withDefaults } from './data.ts';

import type { ViewState } from './data.ts';

/** The directories to read from, the working one by default. */
const directoriesFor = (
  directories: readonly string[],
): readonly string[] => {
  if (directories.length === 0) {
    return [process.cwd()];
  }
  return directories;
};

/** Renders one view and answers the HTML it produced. */
const renderView = async (
  view: string,
  options: unknown,
  state: ViewState,
): Promise<string> => {
  const { engine } = state;
  if (engine === undefined) {
    throw new TypeError(
      'No view engine was configured, so no view renders.',
    );
  }
  const source = await readFrom(
    fileNameFor(view, state.extension),
    directoriesFor(state.directories),
    0,
  );
  return engine(
    source,
    withDefaults(
      state.defaults,
      state.context,
      asData(options),
    ),
  );
};

export { renderView };

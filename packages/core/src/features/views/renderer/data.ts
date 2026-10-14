import { toDirectories } from '#adapter/core/request/directories';
import { isRecord } from '#adapter/core/request/query/index';

import type {
  ViewData,
  ViewEngine,
  ViewOptions,
} from '#adapter/features/views/types';

/** The fields a renderer keeps and a render reads. */
interface ViewState {
  /** The values added at runtime, merged onto every render. */
  context: ViewData;
  /** The default data a configuration named. */
  defaults: ViewData;
  /** The directories a view is read from. */
  directories: readonly string[];
  /** The engine a render is handed the source of. */
  engine: ViewEngine | undefined;
  /** The extension a view name is completed with. */
  extension: string;
}

/** The value a handler returned, as the object a template reads. */
const asData = (options: unknown): ViewData => {
  if (isRecord(options)) {
    return options;
  }

  return {};
};

/** The engine a deployment configured, when it configured one. */
const engineOf = (
  views: ViewOptions | undefined,
): ViewEngine | undefined => {
  if (views === undefined) {
    return undefined;
  }

  return views.engine;
};

/** The directories a deployment configured, when it named any. */
const directoriesOf = (
  views: ViewOptions | undefined,
): readonly string[] => {
  if (views === undefined) {
    return [];
  }

  const { directory } = views;
  if (directory === undefined) {
    return [];
  }

  return toDirectories(directory);
};

/** Merges defaults, locals and the handler's data into one. */
const withDefaults = (
  defaults: ViewData,
  locals: ViewData,
  data: ViewData,
): ViewData =>
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- object spread defin
  ({ ...defaults, ...locals, ...data });

export { asData, directoriesOf, engineOf, withDefaults };
export type { ViewState };

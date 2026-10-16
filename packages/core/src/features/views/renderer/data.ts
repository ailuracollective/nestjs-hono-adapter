import { toDirectories } from '#adapter/core/request/directories';
import { isRecord } from '#adapter/core/request/query/index';
import { rendererOf } from '#adapter/features/views/engine-value';

import type { Renderer, ViewData, ViewOptions } from '#adapter/features/views/types';

interface ViewState {
  context: ViewData;
  defaults: ViewData;
  directories: readonly string[];
  engine: Renderer | undefined;
  engineName: string | undefined;
  engines: Map<string, Renderer>;
  extension: string;
}

const asData = (options: unknown): ViewData => {
  if (isRecord(options)) {
    return options;
  }

  return {};
};

const engineOf = (views: ViewOptions | undefined): Renderer | undefined => {
  if (views === undefined) return undefined;

  return rendererOf(views.engine, 'source');
};

const directoriesOf = (views: ViewOptions | undefined): readonly string[] => {
  if (views === undefined) return [];

  const { directory } = views;
  if (directory === undefined) return [];

  return toDirectories(directory);
};

const withDefaults = (defaults: ViewData, locals: ViewData, data: ViewData): ViewData =>
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- object spread defin
  ({ ...defaults, ...locals, ...data });

export { asData, directoriesOf, engineOf, withDefaults };
export type { ViewState };

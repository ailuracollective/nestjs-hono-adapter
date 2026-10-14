import { toDirectories } from '#adapter/core/request/directories';
import type { ViewEngineOptions } from '#adapter/features/views/types';

/** The fields of such a configuration this adapter reads. */
const VIEW_FIELDS = new Set([
  'defaultContext',
  'engine',
  'includeViewExtension',
  'maxCache',
  'production',
  'root',
  'templates',
  'viewExt',
]);

/** The first configuration field it cannot honour. */
const refusedField = (
  options: ViewEngineOptions,
): string | undefined => {
  for (const name of Object.keys(options)) {
    if (!VIEW_FIELDS.has(name)) {
      return name;
    }
  }

  return undefined;
};

/** The directories such a configuration names. */
const directoriesFrom = (
  options: ViewEngineOptions,
): readonly string[] => {
  const { root, templates } = options;
  if (root !== undefined) {
    return [root];
  }
  if (templates === undefined) {
    return [];
  }

  return toDirectories(templates);
};

export { directoriesFrom, refusedField };
